"""
Image Moderation Model — NSFW Detection using Vision Transformer (ViT)

Uses Falconsai/nsfw_image_detection, a fine-tuned ViT model that classifies
images as 'nsfw' or 'normal'. Runs locally on CPU with ~200ms inference time.

Usage:
    from image_model import load_image_model, predict_image
    
    load_image_model()  # Call once at startup
    result = predict_image(image_bytes)
    # result = { 'nsfw_score': 0.95, 'is_nsfw': True, 'action': 'block', 'label': 'nsfw' }
"""

import io
import logging
import time
from typing import Optional

from PIL import Image

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────

IMAGE_MODEL_NAME = "AdamCodd/vit-base-nsfw-detector"
NSFW_BLOCK_THRESHOLD = 0.50  # Block if nsfw_score >= 50%

# ─────────────────────────────────────────────────────────────
# Model State
# ─────────────────────────────────────────────────────────────

_image_pipeline = None
_image_model_loaded = False


def is_image_model_loaded() -> bool:
    """Check if the image model is loaded."""
    return _image_model_loaded


def load_image_model() -> None:
    """
    Load the NSFW detection ViT model.
    Downloads ~350MB on first run, cached after that.
    """
    global _image_pipeline, _image_model_loaded

    if _image_model_loaded:
        logger.info("Image model already loaded, skipping.")
        return

    logger.info(f"Loading image moderation model: {IMAGE_MODEL_NAME}")
    start = time.time()

    try:
        from transformers import pipeline
        _image_pipeline = pipeline(
            "image-classification",
            model=IMAGE_MODEL_NAME,
            device=-1,  # CPU
        )
        _image_model_loaded = True
        elapsed = time.time() - start
        logger.info(f"Image model loaded in {elapsed:.1f}s")
    except Exception as e:
        logger.error(f"Failed to load image model: {e}")
        raise RuntimeError(f"Image model load failed: {e}")


def predict_image(image_bytes: bytes) -> dict:
    """
    Run NSFW detection on image bytes.
    
    Args:
        image_bytes: Raw image file bytes (JPEG/PNG/WebP)
    
    Returns:
        dict with keys:
            - nsfw_score (float): Probability of NSFW content (0.0-1.0)
            - normal_score (float): Probability of normal content (0.0-1.0)
            - is_nsfw (bool): Whether the image is classified as NSFW
            - action (str): 'block' or 'allow'
            - label (str): 'nsfw' or 'normal'
    """
    if not _image_model_loaded or _image_pipeline is None:
        raise RuntimeError("Image model not loaded. Call load_image_model() first.")

    start = time.time()

    try:
        # Open image from bytes
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Run inference
        results = _image_pipeline(image)
        
        # Parse results — model returns list of {label, score}
        scores = {r["label"].lower(): r["score"] for r in results}
        nsfw_score = scores.get("nsfw", 0.0)
        normal_score = scores.get("normal", 1.0)
        
        is_nsfw = nsfw_score >= NSFW_BLOCK_THRESHOLD
        action = "block" if is_nsfw else "allow"
        label = "nsfw" if is_nsfw else "normal"
        
        elapsed_ms = int((time.time() - start) * 1000)
        logger.info(
            f"Image prediction: nsfw={nsfw_score:.4f}, normal={normal_score:.4f}, "
            f"action={action}, time={elapsed_ms}ms"
        )
        
        return {
            "nsfw_score": round(nsfw_score, 4),
            "normal_score": round(normal_score, 4),
            "is_nsfw": is_nsfw,
            "action": action,
            "label": label,
            "processing_time_ms": elapsed_ms,
        }
    except Exception as e:
        logger.error(f"Image prediction failed: {e}")
        # Fail-closed: if prediction fails, block the image
        return {
            "nsfw_score": 1.0,
            "normal_score": 0.0,
            "is_nsfw": True,
            "action": "block",
            "label": "error",
            "error": str(e),
            "processing_time_ms": 0,
        }
