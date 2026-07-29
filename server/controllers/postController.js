const db = require('../config/db');
const path = require('path');
const { uploadPostImage, deletePostImage } = require('../services/azureStorage');
const moderationService = require('../services/moderationService');
const cacheService = require('../services/cacheService');

exports.createPost = async (req, res) => {
  try {
    const { caption } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'Image is required' 
      });
    }

    // Upload image first (unchanged)
    let imageUrl;
    try {
      imageUrl = await uploadPostImage(
        req.file.buffer,
        req.file.originalname
      );
    } catch (azureError) {
      console.warn('Azure upload failed, using local storage fallback:', azureError.message);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(req.file.originalname);
      const name = path.basename(req.file.originalname, ext);
      const filename = `${name}-${uniqueSuffix}${ext}`;
      
      const fs = require('fs');
      const uploadsDir = path.join(__dirname, '../uploads/posts');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      imageUrl = `/uploads/posts/${filename}`;
    }

    // Always set moderation_status = 'pending' — every post has an image that needs AI review
    const hasCaptionToModerate = caption && caption.trim();

    const [result] = await db.execute(
      'INSERT INTO posts (user_id, image_url, caption, moderation_status) VALUES (?, ?, ?, ?)',
      [userId, imageUrl, caption || '', 'pending']
    );

    const postId = result.insertId;

    // Build the full image URL for the AI worker to download
    const BACKEND_URL = process.env.BACKEND_URL || 'http://backend-1:5000';
    const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${BACKEND_URL}${imageUrl}`;

    // Queue image for NSFW moderation
    await moderationService.queueForModeration(
      postId, postId, userId, '', 'image', { imageUrl: fullImageUrl }
    );

    // Queue caption for text moderation if it has content
    if (hasCaptionToModerate) {
      await moderationService.queueForModeration(
        postId, postId, userId, caption, 'caption'
      );
    }

    const [post] = await db.execute(
      `SELECT p.*, u.username, u.display_name, u.profile_picture,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND status IN ('approved','warned')) as comments_count,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [userId, postId]
    );

    // Invalidate feed caches
    await cacheService.invalidatePattern('cache:feed:*');

    res.status(202).json({
      success: true,
      post: post[0],
      moderation_status: 'pending',
      message: 'Post created. Your image is being reviewed by AI...',
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getAllPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 100, offset = 0 } = req.query;
    const page = Math.floor(parseInt(offset) / parseInt(limit));

    const posts = await cacheService.getOrSet(
      cacheService.keyFor.allPosts(page),
      cacheService.TTL.FEED,
      async () => {
        const [rows] = await db.execute(
          `SELECT p.*, u.username, u.display_name, u.profile_picture,
           (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND status IN ('approved','warned')) as comments_count,
           EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked,
           EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = ?) as is_saved
           FROM posts p
           JOIN users u ON p.user_id = u.id
           ORDER BY p.created_at DESC
           LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
          [userId, userId]
        );
        return rows;
      }
    );

    res.json({
      success: true,
      posts: posts || []
    });
  } catch (error) {
    console.error('Get all posts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getFeedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    let statusColumnExists = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM followers LIKE 'status'");
      statusColumnExists = columns.length > 0;
    } catch (error) {
      console.log('Could not check for status column:', error.message);
    }

    let query, params;
    if (statusColumnExists) {
      query = `SELECT p.*, u.username, u.display_name, u.profile_picture,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND status IN ('approved','warned')) as comments_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked,
               EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = ?) as is_saved
               FROM posts p
               JOIN users u ON p.user_id = u.id
               WHERE p.user_id IN (
                 SELECT following_id FROM followers WHERE follower_id = ? AND status = 'accepted'
               )
               ORDER BY p.created_at DESC
               LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
      params = [userId, userId, userId];
    } else {
      query = `SELECT p.*, u.username, u.display_name, u.profile_picture,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND status IN ('approved','warned')) as comments_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked,
               EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = ?) as is_saved
               FROM posts p
               JOIN users u ON p.user_id = u.id
               WHERE p.user_id IN (
                 SELECT following_id FROM followers WHERE follower_id = ?
               )
               ORDER BY p.created_at DESC
               LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
      params = [userId, userId, userId];
    }

    const [posts] = await db.execute(query, params);

    res.json({
      success: true,
      posts: posts || [],
      hasMore: (posts || []).length >= parseInt(limit)
    });
  } catch (error) {
    console.error('Get feed posts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [posts] = await db.execute(
      `SELECT p.*, u.username, u.display_name, u.profile_picture, u.id as user_id,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND status IN ('approved','warned')) as comments_count,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked,
       EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = ?) as is_saved
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [userId, userId, postId]
    );

    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found' 
      });
    }

    res.json({
      success: true,
      post: posts[0]
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getUserPosts = async (req, res) => {
  try {
    const { username } = req.params;
    const userId = req.user.id;

    const [users] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
    
    if (users.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const targetUserId = users[0].id;

    const [posts] = await db.execute(
      `SELECT p.*, u.username, u.display_name, u.profile_picture, u.id as user_id,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND status IN ('approved','warned')) as comments_count,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked,
       EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = ?) as is_saved
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
      [userId, userId, targetUserId]
    );

    res.json({
      success: true,
      posts: posts || []
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [posts] = await db.execute(
      'SELECT * FROM posts WHERE id = ? AND user_id = ?',
      [postId, userId]
    );

    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found or unauthorized' 
      });
    }

    const post = posts[0];

    if (post.image_url && post.image_url.includes('blob.core.windows.net')) {
      await deletePostImage(post.image_url);
    }

    await db.execute('DELETE FROM posts WHERE id = ?', [postId]);

    res.json({ 
      success: true,
      message: 'Post deleted successfully' 
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [posts] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [postId]);
    
    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found' 
      });
    }

    const postOwnerId = posts[0].user_id;

    const [existingLike] = await db.execute(
      'SELECT * FROM likes WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    if (existingLike.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Post already liked' 
      });
    }

    await db.execute('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);

    if (postOwnerId !== userId) {
      await db.execute(
        'INSERT INTO notifications (user_id, sender_id, type, post_id) VALUES (?, ?, ?, ?)',
        [postOwnerId, userId, 'like', postId]
      );
    }

    const [result] = await db.execute(
      'SELECT COUNT(*) as likes_count FROM likes WHERE post_id = ?',
      [postId]
    );

    res.json({ 
      success: true,
      message: 'Post liked',
      likes_count: result[0].likes_count 
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.unlikePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [result] = await db.execute(
      'DELETE FROM likes WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Post not liked' 
      });
    }

    const [countResult] = await db.execute(
      'SELECT COUNT(*) as likes_count FROM likes WHERE post_id = ?',
      [postId]
    );

    res.json({ 
      success: true,
      message: 'Post unliked', 
      likes_count: countResult[0].likes_count 
    });
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false,
        message: 'Comment content is required' 
      });
    }

    // Verify post exists
    const [posts] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [postId]);
    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found' 
      });
    }

    const postOwnerId = posts[0].user_id;

    // === ASYNC MODERATION: Create comment as 'pending' ===
    const [result] = await db.execute(
      'INSERT INTO comments (post_id, user_id, content, status) VALUES (?, ?, ?, ?)',
      [postId, userId, content, 'pending']
    );

    const commentId = result.insertId;

    // Queue for AI moderation (async — worker will update status)
    await moderationService.queueForModeration(
      commentId, parseInt(postId), userId, content, 'comment'
    );

    // Notification will be sent after moderation approves (handled by worker)
    // For now, just store notification intent
    if (postOwnerId !== userId) {
      await db.execute(
        'INSERT INTO notifications (user_id, sender_id, type, post_id, message) VALUES (?, ?, ?, ?, ?)',
        [postOwnerId, userId, 'comment', postId, content]
      );
    }

    // Fetch the created comment
    const [comments] = await db.execute(
      `SELECT c.*, u.username, u.display_name, u.profile_picture
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [commentId]
    );

    // Invalidate comment cache for this post
    await cacheService.invalidatePattern(`cache:comments:${postId}:*`);

    // Return 202 Accepted (content under review)
    res.status(202).json({
      success: true,
      comment: comments[0],
      moderation_status: 'pending',
      message: 'Comment submitted for review.',
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // Filter out blocked comments server-side; include status for pending/warned indicators
    const [comments] = await db.execute(
      `SELECT c.*, u.username, u.display_name, u.profile_picture
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ? AND c.status != 'blocked'
       ORDER BY c.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      [postId]
    );

    res.json({
      success: true,
      comments: comments || []
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.savePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [posts] = await db.execute('SELECT id FROM posts WHERE id = ?', [postId]);
    
    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found' 
      });
    }

    const [existing] = await db.execute(
      'SELECT * FROM saved_posts WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Post already saved' 
      });
    }

    await db.execute('INSERT INTO saved_posts (post_id, user_id) VALUES (?, ?)', [postId, userId]);

    res.json({ 
      success: true,
      message: 'Post saved' 
    });
  } catch (error) {
    console.error('Save post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.unsavePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [result] = await db.execute(
      'DELETE FROM saved_posts WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Post not saved' 
      });
    }

    res.json({ 
      success: true,
      message: 'Post unsaved' 
    });
  } catch (error) {
    console.error('Unsave post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getSavedPosts = async (req, res) => {
  try {
    const userId = req.user.id;

    const [posts] = await db.execute(
      `SELECT p.*, u.username, u.display_name, u.profile_picture,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND status IN ('approved','warned')) as comments_count,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked,
       true as is_saved
       FROM posts p
       JOIN users u ON p.user_id = u.id
       JOIN saved_posts sp ON p.id = sp.post_id
       WHERE sp.user_id = ?
       ORDER BY sp.created_at DESC`,
      [userId, userId]
    );

    res.json({
      success: true,
      posts: posts || []
    });
  } catch (error) {
    console.error('Get saved posts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getLikedPosts = async (req, res) => {
  try {
    const userId = req.user.id;

    const [posts] = await db.execute(
      `SELECT p.*, u.username, u.display_name, u.profile_picture,
       l.created_at as liked_at
       FROM posts p
       JOIN users u ON p.user_id = u.id
       JOIN likes l ON p.id = l.post_id
       WHERE l.user_id = ?
       ORDER BY l.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      posts: posts || []
    });
  } catch (error) {
    console.error('Get liked posts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getCommentedPosts = async (req, res) => {
  try {
    const userId = req.user.id;

    const [posts] = await db.execute(
      `SELECT DISTINCT p.*, u.username, u.display_name, u.profile_picture,
       c.created_at as commented_at, c.content as comment_content
       FROM posts p
       JOIN users u ON p.user_id = u.id
       JOIN comments c ON p.id = c.post_id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      posts: posts || []
    });
  } catch (error) {
    console.error('Get commented posts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// ─── React to Post (emoji reactions) ─────────────────────────
exports.reactToPost = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user.id;
    const { type } = req.body;

    const validTypes = ['❤️', '😂', '😮', '😢', '😡'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid reaction type' });
    }

    // Check if user already reacted
    const [existing] = await db.execute(
      'SELECT id, type FROM reactions WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    if (existing.length > 0) {
      if (existing[0].type === type) {
        // Same reaction — remove it (toggle off)
        await db.execute('DELETE FROM reactions WHERE id = ?', [existing[0].id]);
        // Also remove from likes table if it was a heart
        if (type === '❤️') {
          await db.execute('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
        }
      } else {
        // Different reaction — update it
        await db.execute('UPDATE reactions SET type = ? WHERE id = ?', [type, existing[0].id]);
        // Sync likes table
        if (type === '❤️') {
          await db.execute('INSERT IGNORE INTO likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
        } else {
          await db.execute('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
        }
      }
    } else {
      // New reaction
      await db.execute('INSERT INTO reactions (post_id, user_id, type) VALUES (?, ?, ?)', [postId, userId, type]);
      // Sync likes table for hearts
      if (type === '❤️') {
        await db.execute('INSERT IGNORE INTO likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
      }
    }

    // Return updated reaction counts
    const [reactions] = await db.execute(
      `SELECT type, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY type`,
      [postId]
    );
    const [userReaction] = await db.execute(
      'SELECT type FROM reactions WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );
    const [totalLikes] = await db.execute(
      'SELECT COUNT(*) as count FROM reactions WHERE post_id = ?',
      [postId]
    );

    res.json({
      success: true,
      reactions: reactions || [],
      userReaction: userReaction.length > 0 ? userReaction[0].type : null,
      totalCount: totalLikes[0]?.count || 0,
    });
  } catch (error) {
    console.error('React to post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Get Reactions for a Post ────────────────────────────────
exports.getReactions = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user.id;

    const [reactions] = await db.execute(
      `SELECT type, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY type`,
      [postId]
    );
    const [userReaction] = await db.execute(
      'SELECT type FROM reactions WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );
    const [total] = await db.execute(
      'SELECT COUNT(*) as count FROM reactions WHERE post_id = ?',
      [postId]
    );

    res.json({
      success: true,
      reactions: reactions || [],
      userReaction: userReaction.length > 0 ? userReaction[0].type : null,
      totalCount: total[0]?.count || 0,
    });
  } catch (error) {
    console.error('Get reactions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Preview Comment (Smart Content Warning) ─────────────────
exports.previewComment = async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    // Call AI service directly for a quick check (not queued)
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
    
    try {
      const http = require('http');
      const url = require('url');
      const postData = JSON.stringify({ text: content });
      const parsed = new URL(`${AI_SERVICE_URL}/predict`);
      
      const result = await new Promise((resolve, reject) => {
        const request = http.request({
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
          timeout: 5000,
        }, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        });
        request.on('error', reject);
        request.on('timeout', () => { request.destroy(); reject(new Error('timeout')); });
        request.write(postData);
        request.end();
      });

      const score = result.toxicity_score || 0;
      const action = result.action || 'allow';
      const WARN_THRESHOLD = parseFloat(process.env.MODERATION_WARN_THRESHOLD) || 0.70;

      if (score >= WARN_THRESHOLD || action === 'warn' || action === 'block') {
        // Extract which specific labels triggered the warning
        const triggeredLabels = [];
        if (result.labels) {
          const labelNames = {
            toxic: 'Toxic language',
            severe_toxic: 'Severely toxic',
            obscene: 'Obscene content',
            threat: 'Threatening',
            insult: 'Insulting',
            identity_hate: 'Identity-based hate',
          };
          for (const [key, val] of Object.entries(result.labels)) {
            if (val >= 0.3) {
              triggeredLabels.push({ label: labelNames[key] || key, score: val });
            }
          }
          triggeredLabels.sort((a, b) => b.score - a.score);
        }

        // Track warning shown (for metrics)
        try {
          await db.execute(
            `INSERT INTO reports (reporter_id, reason, description, status) VALUES (?, 'self_correction', ?, 'warning_shown')`,
            [userId, `Preview warning shown | Score: ${score.toFixed(2)} | Text: ${content.substring(0, 100)}`]
          );
        } catch (trackErr) { console.error('Track warning error:', trackErr.message); }

        res.json({
          success: true,
          safe: false,
          warning: 'This comment may be hurtful or violate community guidelines.',
          toxicity_score: score,
          labels: result.labels || {},
          triggered: triggeredLabels,
          action: action,
        });
      } else {
        res.json({ success: true, safe: true });
      }
    } catch (aiError) {
      // If AI service is down, let the comment through (fail-open for preview only)
      console.error('AI preview error:', aiError.message);
      res.json({ success: true, safe: true });
    }
  } catch (error) {
    console.error('Preview comment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};