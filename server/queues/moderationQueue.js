/**
 * Moderation Queue — BullMQ Integration
 * 
 * Replaces synchronous AI moderation with async queue processing.
 * Jobs are consumed by Python AI workers running Toxic-BERT.
 *
 * Queue: content-moderation (BullMQ on Redis)
 * 
 * Job lifecycle:
 *   1. Backend adds job (comment/caption created as 'pending')
 *   2. AI worker picks job from Redis queue
 *   3. Worker runs inference, updates DB, publishes result to pub/sub
 *   4. Backend receives pub/sub message, emits Socket.IO event to client
 *
 * @version 2.0.0
 */

const { Queue, QueueEvents } = require('bullmq');
const { createConnection, getClient } = require('../config/redis');

const QUEUE_NAME = process.env.QUEUE_NAME || 'content-moderation';

// BullMQ Queue instance
let queue = null;
let queueEvents = null;

// Metrics
let queueMetrics = {
  jobs_added: 0,
  jobs_completed: 0,
  jobs_failed: 0,
  jobs_dlq: 0,
};

/**
 * Initialize the BullMQ queue
 * @returns {Queue} BullMQ Queue instance
 */
function getQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: createConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s, 4s, 8s
        },
        timeout: 30000, // 30 second timeout per job
        removeOnComplete: {
          age: 3600,  // Keep completed jobs for 1 hour
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    queue.on('error', (err) => {
      console.error('❌ BullMQ Queue error:', err.message);
    });

    console.log(`✅ BullMQ Queue "${QUEUE_NAME}" initialized`);
  }
  return queue;
}

/**
 * Initialize queue event listeners
 * @param {Function} onCompleted - Callback for completed jobs
 * @param {Function} onFailed - Callback for failed jobs
 */
function initQueueEvents(onCompleted, onFailed) {
  if (!queueEvents) {
    queueEvents = new QueueEvents(QUEUE_NAME, {
      connection: createConnection(),
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      queueMetrics.jobs_completed++;
      if (onCompleted) onCompleted(jobId, returnvalue);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      queueMetrics.jobs_failed++;
      console.error(`❌ Job ${jobId} failed: ${failedReason}`);
      if (onFailed) onFailed(jobId, failedReason);
    });

    console.log('✅ BullMQ QueueEvents listener initialized');
  }
  return queueEvents;
}

/**
 * Add a comment moderation job to the queue
 * 
 * @param {Object} data - Job data
 * @param {number} data.commentId - Comment ID in MySQL
 * @param {number} data.postId - Post ID
 * @param {number} data.userId - User who submitted the content
 * @param {string} data.content - Text content to moderate
 * @param {string} data.contentType - 'comment' or 'caption'
 * @returns {Promise<Object>} Job info { id, name }
 */
async function addModerationJob(data) {
  const q = getQueue();

  const job = await q.add('moderate', {
    commentId: data.commentId,
    postId: data.postId,
    userId: data.userId,
    content: data.content,
    contentType: data.contentType || 'comment',
    imageUrl: data.imageUrl || '',
    createdAt: new Date().toISOString(),
  }, {
    priority: data.contentType === 'caption' ? 1 : (data.contentType === 'image' ? 1 : 2),
    jobId: `mod-${data.contentType}-${data.commentId}-${Date.now()}`,
  });

  queueMetrics.jobs_added++;
  console.log(`📋 Moderation job queued: ${job.id} (${data.contentType}, commentId=${data.commentId})`);

  return { id: job.id, name: job.name };
}

/**
 * Get queue health/stats
 * @returns {Promise<Object>}
 */
async function getQueueStats() {
  try {
    const q = getQueue();
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getCompletedCount(),
      q.getFailedCount(),
      q.getDelayedCount(),
    ]);

    return {
      name: QUEUE_NAME,
      waiting,
      active,
      completed,
      failed,
      delayed,
      ...queueMetrics,
    };
  } catch (error) {
    return { name: QUEUE_NAME, error: error.message };
  }
}

/**
 * Subscribe to moderation results via Redis pub/sub
 * Workers publish results to 'moderation:result' channel.
 * This is how the backend knows to send Socket.IO events.
 * 
 * @param {Function} callback - Called with (resultData) when a moderation completes
 */
function subscribeToResults(callback) {
  const { getSubscriber } = require('../config/redis');
  const sub = getSubscriber();

  sub.subscribe('moderation:result', (err) => {
    if (err) {
      console.error('❌ Failed to subscribe to moderation:result:', err.message);
      return;
    }
    console.log('✅ Subscribed to moderation:result pub/sub channel');
  });

  sub.on('message', (channel, message) => {
    if (channel === 'moderation:result') {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        console.error('❌ Failed to parse moderation result:', error.message);
      }
    }
  });
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  if (queueEvents) await queueEvents.close();
  if (queue) await queue.close();
  console.log('📴 BullMQ queue connections closed');
}

/** Get queue metrics snapshot */
function getMetrics() {
  return { ...queueMetrics };
}

module.exports = {
  getQueue,
  initQueueEvents,
  addModerationJob,
  getQueueStats,
  subscribeToResults,
  shutdown,
  getMetrics,
  QUEUE_NAME,
};
