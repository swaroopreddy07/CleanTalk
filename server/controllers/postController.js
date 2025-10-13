const db = require('../config/db');
const path = require('path');
const { uploadPostImage, deletePostImage } = require('../services/azureStorage');

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

    const [result] = await db.execute(
      'INSERT INTO posts (user_id, image_url, caption) VALUES (?, ?, ?)',
      [userId, imageUrl, caption || '']
    );

    const postId = result.insertId;
    const [post] = await db.execute(
      `SELECT p.*, u.username, u.display_name, u.profile_picture,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [userId, postId]
    );

    res.status(201).json({
      success: true,
      post: post[0]
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

    const [posts] = await db.execute(
      `SELECT p.*, u.username, u.display_name, u.profile_picture,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked,
       EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = ?) as is_saved
       FROM posts p
       JOIN users u ON p.user_id = u.id
       ORDER BY p.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      [userId, userId]
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
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
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
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
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
      posts: posts || []
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
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
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
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
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

    const [posts] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [postId]);
    
    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found' 
      });
    }

    const postOwnerId = posts[0].user_id;

    const [result] = await db.execute(
      'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [postId, userId, content]
    );

    if (postOwnerId !== userId) {
      await db.execute(
        'INSERT INTO notifications (user_id, sender_id, type, post_id, message) VALUES (?, ?, ?, ?, ?)',
        [postOwnerId, userId, 'comment', postId, content]
      );
    }

    const [comments] = await db.execute(
      `SELECT c.*, u.username, u.display_name, u.profile_picture
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      comment: comments[0]
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

    const [comments] = await db.execute(
      `SELECT c.*, u.username, u.display_name, u.profile_picture
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ?
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
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
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