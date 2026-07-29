"""
AI Moderation Worker — BullMQ Consumer (v2.1)

Uses the official bullmq Python package for full compatibility with
BullMQ v5 (Node.js). Consumes moderation jobs, runs Toxic-BERT inference,
updates MySQL with moderation results, and publishes results via pub/sub.

Queue Protocol:
  - Jobs managed by BullMQ's internal Lua scripts
  - Results published to: moderation:result (Redis pub/sub channel)

Usage:
  python worker.py
  WORKER_ID=worker-1 python worker.py

Environment Variables:
  REDIS_HOST      (default: redis)
  REDIS_PORT      (default: 6379)
  DB_HOST         (default: db)
  DB_USER         (default: root)
  DB_PASSWORD     (default: socialconnect_password)
  DB_NAME         (default: socialconnect)
  WORKER_ID       (default: worker-<pid>)
  QUEUE_NAME      (default: content-moderation)
  MAX_RETRIES     (default: 3)
"""

import asyncio
import json
import logging
import os
import signal
import sys
import time
from pathlib import Path

import mysql.connector
from mysql.connector import pooling
import redis as redis_sync
from bullmq import Worker

# Add parent dir to path so we can import model and config
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import get_moderation_action, THRESHOLD_WARN, THRESHOLD_BLOCK
from model import load_model, predict, is_model_loaded
from image_model import load_image_model, predict_image, is_image_model_loaded

# ─────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────

REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
DB_HOST = os.environ.get("DB_HOST", "db")
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "socialconnect_password")
DB_NAME = os.environ.get("DB_NAME", "socialconnect")
WORKER_ID = os.environ.get("WORKER_ID", f"worker-{os.getpid()}")
QUEUE_NAME = os.environ.get("QUEUE_NAME", "content-moderation")
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", 3))
HEALTH_FILE = "/tmp/worker_healthy"

# ─────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format=f"%(asctime)s [{WORKER_ID}] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# State
# ─────────────────────────────────────────────────────────────

_jobs_processed = 0
_jobs_failed = 0
_start_time = time.time()


# ─────────────────────────────────────────────────────────────
# Redis Pub/Sub Client (for publishing results)
# ─────────────────────────────────────────────────────────────

def create_redis_pubsub_client() -> redis_sync.Redis:
    """Create a synchronous Redis client for pub/sub publishing."""
    for attempt in range(10):
        try:
            client = redis_sync.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=10,
                socket_keepalive=True,
                retry_on_timeout=True,
            )
            client.ping()
            logger.info(f"Pub/Sub Redis connected at {REDIS_HOST}:{REDIS_PORT}")
            return client
        except (redis_sync.ConnectionError, redis_sync.TimeoutError) as e:
            wait = min(2 ** attempt, 30)
            logger.warning(f"Redis connection failed (attempt {attempt+1}): {e}. Retrying in {wait}s...")
            time.sleep(wait)

    raise RuntimeError(f"Cannot connect to Redis at {REDIS_HOST}:{REDIS_PORT} after 10 attempts")


# ─────────────────────────────────────────────────────────────
# MySQL Connection Pool
# ─────────────────────────────────────────────────────────────

def create_db_pool():
    """Create a MySQL connection pool with retry logic."""
    for attempt in range(10):
        try:
            pool = pooling.MySQLConnectionPool(
                pool_name=f"{WORKER_ID}_pool",
                pool_size=3,
                host=DB_HOST,
                user=DB_USER,
                password=DB_PASSWORD,
                database=DB_NAME,
                charset="utf8mb4",
                autocommit=True,
                connect_timeout=10,
            )
            # Test connection
            conn = pool.get_connection()
            conn.close()
            logger.info(f"Connected to MySQL at {DB_HOST}/{DB_NAME}")
            return pool
        except mysql.connector.Error as e:
            wait = min(2 ** attempt, 30)
            logger.warning(f"MySQL connection failed (attempt {attempt+1}): {e}. Retrying in {wait}s...")
            time.sleep(wait)

    raise RuntimeError(f"Cannot connect to MySQL at {DB_HOST}/{DB_NAME} after 10 attempts")


# ─────────────────────────────────────────────────────────────
# Job Processing
# ─────────────────────────────────────────────────────────────

def action_to_status(action: str) -> str:
    """Map moderation action to comment status."""
    return {"allow": "approved", "warn": "warned", "block": "blocked"}.get(action, "pending")


def process_job(job_id: str, job_data: dict, pub_redis: redis_sync.Redis, db_pool) -> dict:
    """
    Process a single moderation job.

    1. Run Toxic-BERT inference
    2. Update comment/post status in MySQL
    3. Log to moderation_logs
    4. Publish result to Redis pub/sub
    5. Log to worker_logs
    """
    global _jobs_processed
    start = time.time()

    content = job_data.get("content", "")
    comment_id = job_data.get("commentId")
    post_id = job_data.get("postId")
    user_id = job_data.get("userId")
    content_type = job_data.get("contentType", "comment")

    logger.info(f"Processing job {job_id}: {content_type} #{comment_id} ({len(content) if content else 0} chars)")

    # Handle image moderation
    if content_type == 'image':
        image_url = job_data.get("imageUrl", "")
        logger.info(f"Image moderation job: {image_url[:100]}")
        
        # Lazy load image model on first image job
        if not is_image_model_loaded():
            logger.info("Image model not loaded — loading now (first image job)...")
            load_image_model()
            logger.info("Image model loaded successfully (lazy).")
        
        import requests as http_requests
        try:
            # Download the image
            resp = http_requests.get(image_url, timeout=15)
            resp.raise_for_status()
            image_bytes = resp.content
            
            # Run NSFW detection
            img_result = predict_image(image_bytes)
            toxicity_score = img_result["nsfw_score"]
            action = img_result["action"]
            status = action_to_status(action)
            labels = {"nsfw": img_result["nsfw_score"], "normal": img_result["normal_score"]}
            prediction = img_result["label"]
            
            logger.info(f"Image inference: nsfw={toxicity_score:.4f}, action={action}")
        except Exception as img_err:
            logger.error(f"Image moderation failed: {img_err}")
            # Fail-closed: block if we can't check the image
            toxicity_score = 1.0
            action = "block"
            status = "blocked"
            labels = {"error": str(img_err)}
            prediction = "error"
    else:
        # Lazy load text model on first text job
        if not is_model_loaded():
            logger.info("Text model not loaded — loading now (first text job)...")
            load_model()
            logger.info("Text model loaded successfully (lazy).")
        
        # Text moderation (existing flow)
        result = predict(content)
        toxicity_score = result["toxicity_score"]
        action = result["action"]
        status = action_to_status(action)
        labels = result["labels"]
        prediction = result["prediction"]

    processing_time_ms = int((time.time() - start) * 1000)

    logger.info(
        f"Inference complete: score={toxicity_score:.4f}, action={action}, "
        f"status={status}, time={processing_time_ms}ms"
    )

    # Update database
    conn = db_pool.get_connection()
    cursor = conn.cursor()

    try:
        if content_type == "comment":
            cursor.execute(
                "UPDATE comments SET status = %s WHERE id = %s",
                (status, comment_id)
            )
        elif content_type in ("caption", "image"):
            # WORST-WINS: Never downgrade from 'blocked' to 'approved'
            # If image moderation blocked it, caption moderation can't un-block it
            if status == "blocked":
                # Always apply block
                cursor.execute(
                    "UPDATE posts SET moderation_status = 'blocked' WHERE id = %s",
                    (post_id,)
                )
            else:
                # Only approve if not already blocked by another job
                cursor.execute(
                    "UPDATE posts SET moderation_status = %s WHERE id = %s AND moderation_status != 'blocked'",
                    (status, post_id)
                )

        # Log to moderation_logs
        cursor.execute(
            """INSERT INTO moderation_logs
               (user_id, post_id, content, content_type, prediction, confidence, labels, action_taken)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                user_id, post_id, content, content_type,
                prediction, toxicity_score,
                json.dumps(labels), status,
            )
        )

        # Log to worker_logs
        cursor.execute(
            """INSERT INTO worker_logs
               (worker_id, job_id, comment_id, content_type, action,
                toxicity_score, processing_time_ms, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, 'completed')""",
            (
                WORKER_ID, job_id, comment_id, content_type,
                action, toxicity_score, processing_time_ms,
            )
        )

        conn.commit()
        logger.info(f"Database updated: {content_type} #{comment_id} → {status}")

    except mysql.connector.Error as e:
        conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

    # Publish result to Redis pub/sub for Socket.IO broadcast
    result_data = {
        "commentId": comment_id,
        "postId": post_id,
        "userId": user_id,
        "status": status,
        "action": action,
        "contentType": content_type,
        "toxicity_score": toxicity_score,
        "labels": labels,
        "prediction": prediction,
        "processingTime": processing_time_ms,
        "workerId": WORKER_ID,
    }

    pub_redis.publish("moderation:result", json.dumps(result_data))
    logger.info(f"Result published to moderation:result channel")

    _jobs_processed += 1
    return result_data


# ─────────────────────────────────────────────────────────────
# Main Worker Loop (async, using official bullmq Python package)
# ─────────────────────────────────────────────────────────────

async def main():
    global _jobs_processed, _jobs_failed

    logger.info(f"Starting AI Moderation Worker: {WORKER_ID}")
    logger.info(f"Queue: {QUEUE_NAME}, Max Retries: {MAX_RETRIES}")

    # 1. Models use lazy loading — loaded on first job (see process_job)
    logger.info("Models will be loaded lazily on first job.")

    # 2. Connect Redis for pub/sub
    pub_redis = create_redis_pubsub_client()

    # 3. Connect to MySQL
    db_pool = create_db_pool()

    # 4. Mark healthy
    Path(HEALTH_FILE).touch()
    logger.info(f"Worker healthy (health file: {HEALTH_FILE})")

    # 5. Setup shutdown event
    shutdown_event = asyncio.Event()

    def signal_handler(signum, frame):
        sig_name = signal.Signals(signum).name
        logger.info(f"Received {sig_name}, shutting down gracefully...")
        shutdown_event.set()

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # 6. Define the BullMQ processor
    async def processor(job, job_token):
        """Process a moderation job from BullMQ."""
        try:
            job_data = job.data
            result = process_job(job.id, job_data, pub_redis, db_pool)
            return json.dumps(result)
        except Exception as e:
            _jobs_failed += 1
            logger.error(f"Error processing job {job.id}: {e}", exc_info=True)

            # Log failure to worker_logs
            try:
                conn = db_pool.get_connection()
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO worker_logs
                       (worker_id, job_id, comment_id, content_type, status, error_message)
                       VALUES (%s, %s, %s, %s, 'failed', %s)""",
                    (
                        WORKER_ID, job.id,
                        job_data.get("commentId"),
                        job_data.get("contentType", "comment"),
                        str(e)[:500],
                    )
                )
                conn.commit()
                cursor.close()
                conn.close()
            except Exception as log_err:
                logger.error(f"Failed to log error: {log_err}")

            raise  # Re-raise so BullMQ handles retries

    # 7. Create the BullMQ Worker
    worker = Worker(
        QUEUE_NAME,
        processor,
        {"connection": f"redis://{REDIS_HOST}:{REDIS_PORT}"}
    )

    logger.info("=" * 60)
    logger.info(f"Worker {WORKER_ID} ready! Waiting for jobs...")
    logger.info("=" * 60)

    # 8. Wait for shutdown signal
    await shutdown_event.wait()

    # 9. Cleanup
    logger.info("Shutting down worker...")
    await worker.close()

    try:
        Path(HEALTH_FILE).unlink(missing_ok=True)
    except Exception:
        pass

    uptime = time.time() - _start_time
    logger.info(
        f"Worker {WORKER_ID} stopped. "
        f"Processed: {_jobs_processed}, Failed: {_jobs_failed}, "
        f"Uptime: {uptime:.0f}s"
    )


if __name__ == "__main__":
    asyncio.run(main())
