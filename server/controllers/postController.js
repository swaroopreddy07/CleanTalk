const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const { uploadPostImage, deletePostImage } = require('../services/azureStorage');

const uploadImage = async (file) => {
  try {
    return await uploadPostImage(file.buffer, file.originalname);
  } catch (error) {
    console.warn('Azure upload failed, using local storage:', error.message);
    const uploadsDir = path.join(__dirname, '../uploads/posts');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const filename = `${name}-${uniqueSuffix}${ext}`;
    const filePath = path.join(uploadsDir, filename);
    
    fs.writeFileSync(filePath, file.buffer);
    return `/uploads/posts/${filename}`;
  }
};

const hasStatusColumn = async () => {
  try {
    const [columns] = await db.execute("SHOW COLUMNS FROM followers LIKE 'status'");
    return columns.length > 0;
  } catch {
    return false;
  }
};

const getPostQuery = (userId, statusFilter = '') => `
  SELECT p.*, u.username, u.display_name, u.profile_picture, u.id as user_id,
  (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
  (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
  EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked,
  EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = ?) as is_saved
  FROM posts p
  JOIN users u ON p.user_id = u.id
  ${statusFilter}
  ORDER BY p.created_at DESC`;

const createPost = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image is required' });
    }

    const { caption } = req.body;
    const imageUrl = await uploadImage(req.file);
    const [result] = await db.execute(
      'INSERT INTO posts (user_id, image_url, caption) VALUES (?, ?, ?)',
      [req.user.id, imageUrl, caption || '']
    );

    const [post] = await db.execute(
      `${getPostQuery(req.user.id)} WHERE p.id = ?`,
      [req.user.id, req.user.id, result.insertId]
    );

    res.status(201).json({ success: true, post: post[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getAllPosts = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const [posts] = await db.execute(
      `${getPostQuery(req.user.id)} LIMIT ? OFFSET ?`,
      [req.user.id, req.user.id, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, posts: posts || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getFeedPosts = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const hasStatus = await hasStatusColumn();
    const statusFilter = hasStatus
      ? `WHERE p.user_id IN (SELECT following_id FROM followers WHERE follower_id = ? AND status = 'accepted')`
      : `WHERE p.user_id IN (SELECT following_id FROM followers WHERE follower_id = ?)`;

    const [posts] = await db.execute(
      `${getPostQuery(req.user.id, statusFilter)} LIMIT ? OFFSET ?`,
      [req.user.id, req.user.id, req.user.id, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, posts: posts || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getPost = async (req, res) => {
  try {
    const [posts] = await db.execute(
      `${getPostQuery(req.user.id)} WHERE p.id = ?`,
      [req.user.id, req.user.id, req.params.postId]
    );

    if (posts.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    res.json({ success: true, post: posts[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getUserPosts = async (req, res) => {
  try {
    const [users] = await db.execute('SELECT id FROM users WHERE username = ?', [req.params.username]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [posts] = await db.execute(
      `${getPostQuery(req.user.id)} WHERE p.user_id = ?`,
      [req.user.id, req.user.id, users[0].id]
    );

    res.json({ success: true, posts: posts || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deletePost = async (req, res) => {
  try {
    const [posts] = await db.execute(
      'SELECT * FROM posts WHERE id = ? AND user_id = ?',
      [req.params.postId, req.user.id]
    );

    if (posts.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found or unauthorized' });
    }

    if (posts[0].image_url?.includes('blob.core.windows.net')) {
      await deletePostImage(posts[0].image_url);
    }

    await db.execute('DELETE FROM posts WHERE id = ?', [req.params.postId]);
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const [posts] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [postId]);
    
    if (posts.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const [existing] = await db.execute(
      'SELECT id FROM likes WHERE post_id = ? AND user_id = ?',
      [postId, req.user.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Post already liked' });
    }

    await db.execute('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [postId, req.user.id]);

    if (posts[0].user_id !== req.user.id) {
      await db.execute(
        'INSERT INTO notifications (user_id, sender_id, type, post_id) VALUES (?, ?, ?, ?)',
        [posts[0].user_id, req.user.id, 'like', postId]
      );
    }

    const [result] = await db.execute(
      'SELECT COUNT(*) as likes_count FROM likes WHERE post_id = ?',
      [postId]
    );

    res.json({ success: true, message: 'Post liked', likes_count: result[0].likes_count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const unlikePost = async (req, res) => {
  try {
    const [result] = await db.execute(
      'DELETE FROM likes WHERE post_id = ? AND user_id = ?',
      [req.params.postId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'Post not liked' });
    }

    const [countResult] = await db.execute(
      'SELECT COUNT(*) as likes_count FROM likes WHERE post_id = ?',
      [req.params.postId]
    );

    res.json({ success: true, message: 'Post unliked', likes_count: countResult[0].likes_count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const addComment = async (req, res) => {
  try {
    const { content } = req.body;
    const { postId } = req.params;

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const [posts] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [postId]);
    if (posts.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const [result] = await db.execute(
      'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [postId, req.user.id, content]
    );

    if (posts[0].user_id !== req.user.id) {
      await db.execute(
        'INSERT INTO notifications (user_id, sender_id, type, post_id, message) VALUES (?, ?, ?, ?, ?)',
        [posts[0].user_id, req.user.id, 'comment', postId, content]
      );
    }

    const [comments] = await db.execute(
      `SELECT c.*, u.username, u.display_name, u.profile_picture
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, comment: comments[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getComments = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const [comments] = await db.execute(
      `SELECT c.*, u.username, u.display_name, u.profile_picture
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ?
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.params.postId, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, comments: comments || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const savePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const [posts] = await db.execute('SELECT id FROM posts WHERE id = ?', [postId]);
    
    if (posts.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const [existing] = await db.execute(
      'SELECT id FROM saved_posts WHERE post_id = ? AND user_id = ?',
      [postId, req.user.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Post already saved' });
    }

    await db.execute('INSERT INTO saved_posts (post_id, user_id) VALUES (?, ?)', [postId, req.user.id]);
    res.json({ success: true, message: 'Post saved' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const unsavePost = async (req, res) => {
  try {
    const [result] = await db.execute(
      'DELETE FROM saved_posts WHERE post_id = ? AND user_id = ?',
      [req.params.postId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'Post not saved' });
    }

    res.json({ success: true, message: 'Post unsaved' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getSavedPosts = async (req, res) => {
  try {
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
      [req.user.id, req.user.id]
    );

    res.json({ success: true, posts: posts || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getLikedPosts = async (req, res) => {
  try {
    const [posts] = await db.execute(
      `SELECT p.*, u.username, u.display_name, u.profile_picture,
       l.created_at as liked_at
       FROM posts p
       JOIN users u ON p.user_id = u.id
       JOIN likes l ON p.id = l.post_id
       WHERE l.user_id = ?
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, posts: posts || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getCommentedPosts = async (req, res) => {
  try {
    const [posts] = await db.execute(
      `SELECT DISTINCT p.*, u.username, u.display_name, u.profile_picture,
       c.created_at as commented_at, c.content as comment_content
       FROM posts p
       JOIN users u ON p.user_id = u.id
       JOIN comments c ON p.id = c.post_id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, posts: posts || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createPost,
  getAllPosts,
  getFeedPosts,
  getPost,
  getUserPosts,
  deletePost,
  likePost,
  unlikePost,
  addComment,
  getComments,
  savePost,
  unsavePost,
  getSavedPosts,
  getLikedPosts,
  getCommentedPosts
};
