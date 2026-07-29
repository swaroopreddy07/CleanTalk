/**
 * Moderation Service v2.0 — Async Queue-Based
 * 
 * BREAKING CHANGE from v1.0:
 *   v1.0: Synchronous HTTP call to AI service → instant result → allow/warn/block
 *   v2.0: Queue job to BullMQ → AI worker processes async → result via pub/sub
 *
 * New flow:
 *   1. Content created as 'pending' in DB
 *   2. Job added to BullMQ queue
 *   3. AI worker processes job (Toxic-BERT inference)
 *   4. Worker updates DB status + publishes result to Redis pub/sub
 *   5. Backend receives pub/sub → emits Socket.IO event to client
 *
 * Fail strategy: FAIL-CLOSED
 *   If queue/Redis is down → content stays 'pending' (never auto-published)
 *
 * @version 2.0.0
 */

const db = require('../config/db');
const { addModerationJob, subscribeToResults, getQueueStats } = require('../queues/moderationQueue');
const { recordModerationResult } = require('./metricsService');

// ================================
// CONFIGURATION
// ================================

const THRESHOLDS = {
  WARN: parseFloat(process.env.MODERATION_WARN_THRESHOLD) || 0.70,
  BLOCK: parseFloat(process.env.MODERATION_BLOCK_THRESHOLD) || 0.90,
};

// ================================
// QUEUE-BASED MODERATION
// ================================

/**
 * Queue content for async moderation
 * Content is already created in DB as 'pending' before calling this.
 *
 * @param {number} commentId - The comment/post ID in the database
 * @param {number} postId - The post ID
 * @param {number} userId - User who submitted
 * @param {string} content - Text to moderate
 * @param {string} contentType - 'comment' or 'caption'
 * @returns {Promise<Object>} Job info { id, queued: true }
 */
async function queueForModeration(commentId, postId, userId, content, contentType, extra = {}) {
  try {
    const job = await addModerationJob({
      commentId,
      postId,
      userId,
      content,
      contentType,
      ...extra,
    });

    console.log(`📋 Content queued for moderation: ${contentType} #${commentId} → job ${job.id}`);
    return { id: job.id, queued: true };
  } catch (error) {
    // FAIL-CLOSED: If queue is down, content stays 'pending'
    console.error(`❌ FAIL-CLOSED: Could not queue ${contentType} #${commentId}:`, error.message);
    console.warn(`⚠️ Content will remain 'pending' until queue is available and job is manually requeued`);
    return { id: null, queued: false, error: error.message };
  }
}

/**
 * Determine action based on toxicity score
 * Used by AI workers, kept here for consistency.
 * @param {number} score - Toxicity score (0.0 to 1.0)
 * @returns {string} 'allow' | 'warn' | 'block'
 */
function getActionFromScore(score) {
  if (score >= THRESHOLDS.BLOCK) return 'block';
  if (score >= THRESHOLDS.WARN) return 'warn';
  return 'allow';
}

/**
 * Map moderation action to comment status
 * @param {string} action - 'allow' | 'warn' | 'block'
 * @returns {string} 'approved' | 'warned' | 'blocked'
 */
function actionToStatus(action) {
  switch (action) {
    case 'allow': return 'approved';
    case 'warn': return 'warned';
    case 'block': return 'blocked';
    default: return 'pending';
  }
}

/**
 * Log a moderation event to the moderation_logs table
 * Called by AI workers after processing, but can also be called directly.
 *
 * @param {number} userId
 * @param {number|null} postId
 * @param {string} content
 * @param {string} contentType - 'comment' or 'caption'
 * @param {Object} moderationResult - { toxicity_score, labels, prediction, action }
 * @param {string} actionTaken - 'blocked', 'warned', 'force_posted', 'approved'
 * @returns {Promise<number|null>} Log entry ID
 */
async function logModeration(userId, postId, content, contentType, moderationResult, actionTaken) {
  try {
    const [result] = await db.execute(
      `INSERT INTO moderation_logs 
       (user_id, post_id, content, content_type, prediction, confidence, labels, action_taken) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        postId || null,
        content,
        contentType,
        moderationResult.prediction || 'unknown',
        moderationResult.toxicity_score || 0,
        JSON.stringify(moderationResult.labels || {}),
        actionTaken,
      ]
    );
    return result.insertId;
  } catch (error) {
    console.error('❌ Failed to log moderation event:', error.message);
    return null;
  }
}

/**
 * Initialize the moderation result listener
 * Subscribes to Redis pub/sub channel 'moderation:result'
 * and emits Socket.IO events to the relevant users.
 *
 * @param {Object} io - Socket.IO server instance
 * @param {Map} userSockets - Map of userId → socketId
 */
function initModerationListener(io, userSockets) {
  subscribeToResults((result) => {
    console.log(`📨 Moderation result received: comment #${result.commentId} → ${result.status}`);

    // Record metrics
    recordModerationResult(
      result.action || result.status,
      result.contentType || 'comment',
      result.processingTime ? result.processingTime / 1000 : null
    );

    // Emit to the comment author
    if (result.userId) {
      const socketId = userSockets.get(result.userId.toString());
      if (socketId) {
        io.to(socketId).emit('moderation:result', {
          commentId: result.commentId,
          postId: result.postId,
          status: result.status,
          action: result.action,
          toxicity_score: result.toxicity_score,
          labels: result.labels,
          contentType: result.contentType,
        });
        console.log(`📡 Socket.IO event sent to user ${result.userId} (socket: ${socketId})`);

        // Emit specific post moderation result for image moderation
        if (result.contentType === 'image' || result.contentType === 'caption') {
          io.to(socketId).emit('post:moderation-result', {
            postId: result.postId,
            status: result.status,
            action: result.action,
            contentType: result.contentType,
            toxicity_score: result.toxicity_score,
            message: result.status === 'blocked'
              ? 'Post rejected — contains inappropriate content'
              : result.status === 'approved'
                ? 'Post approved ✓'
                : 'Post is under review',
          });
        }
      }
    }

    // Also broadcast to the post room so other viewers see the update
    if (result.postId) {
      io.emit('comment:status-update', {
        commentId: result.commentId,
        postId: result.postId,
        status: result.status,
      });

      // Broadcast post moderation status to all users
      if (result.contentType === 'image') {
        io.emit('post:status-update', {
          postId: result.postId,
          status: result.status,
        });
      }
    }
  });

  console.log('✅ Moderation result listener initialized');
}

/**
 * Health check — get queue status
 */
async function healthCheck() {
  return getQueueStats();
}

// ================================
// EXPORTS
// ================================

module.exports = {
  queueForModeration,
  logModeration,
  getActionFromScore,
  actionToStatus,
  initModerationListener,
  healthCheck,
  THRESHOLDS,
};
