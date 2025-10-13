const db = require('../config/db');
const { uploadStoryImage, deleteStoryImage } = require('../services/azureStorage');

exports.createStory = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'Image is required' 
      });
    }

    const imageUrl = await uploadStoryImage(
      req.file.buffer,
      req.file.originalname
    );

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [result] = await db.execute(
      'INSERT INTO stories (user_id, image_url, expires_at) VALUES (?, ?, ?)',
      [userId, imageUrl, expiresAt]
    );

    const [story] = await db.execute(
      `SELECT s.*, u.username, u.display_name, u.profile_picture
       FROM stories s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      story: story[0]
    });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getStories = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    let statusColumnExists = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM followers LIKE 'status'");
      statusColumnExists = columns.length > 0;
    } catch (error) {
      console.log('Could not check for status column:', error.message);
    }

    let query, params;
    if (statusColumnExists) {
      query = `SELECT s.*, u.username, u.display_name, u.profile_picture,
               (s.user_id = ?) as is_own
               FROM stories s
               JOIN users u ON s.user_id = u.id
               WHERE s.expires_at > ? 
               AND (s.user_id = ? OR s.user_id IN (
                 SELECT following_id FROM followers WHERE follower_id = ? AND status = 'accepted'
               ))
               ORDER BY is_own DESC, s.created_at ASC`;
      params = [userId, now, userId, userId];
    } else {
      query = `SELECT s.*, u.username, u.display_name, u.profile_picture,
               (s.user_id = ?) as is_own
               FROM stories s
               JOIN users u ON s.user_id = u.id
               WHERE s.expires_at > ? 
               AND (s.user_id = ? OR s.user_id IN (
                 SELECT following_id FROM followers WHERE follower_id = ?
               ))
               ORDER BY is_own DESC, s.created_at ASC`;
      params = [userId, now, userId, userId];
    }

    const [stories] = await db.execute(query, params);

    const groupedStories = stories.reduce((acc, story) => {
      const key = story.user_id;
      if (!acc[key]) {
        acc[key] = {
          user_id: story.user_id,
          username: story.username,
          display_name: story.display_name,
          profile_picture: story.profile_picture,
          is_own: story.is_own,
          stories: []
        };
      }
      acc[key].stories.push(story);
      return acc;
    }, {});

    res.json({
      success: true,
      stories: Object.values(groupedStories)
    });
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getUserStories = async (req, res) => {
  try {
    const { userId } = req.params;
    const now = new Date();

    const [stories] = await db.execute(
      `SELECT s.*, u.username, u.display_name, u.profile_picture
       FROM stories s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = ? AND s.expires_at > ?
       ORDER BY s.created_at DESC`,
      [userId, now]
    );

    res.json({
      success: true,
      stories: stories || []
    });
  } catch (error) {
    console.error('Get user stories error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    const [stories] = await db.execute(
      'SELECT * FROM stories WHERE id = ? AND user_id = ?',
      [storyId, userId]
    );

    if (stories.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Story not found or unauthorized' 
      });
    }

    const story = stories[0];

    if (story.image_url && story.image_url.includes('blob.core.windows.net')) {
      await deleteStoryImage(story.image_url);
    }

    await db.execute('DELETE FROM stories WHERE id = ?', [storyId]);

    res.json({ 
      success: true,
      message: 'Story deleted successfully' 
    });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.cleanupExpiredStories = async (req, res) => {
  try {
    const now = new Date();

    const [expiredStories] = await db.execute(
      'SELECT * FROM stories WHERE expires_at <= ?',
      [now]
    );

    for (const story of expiredStories) {
      if (story.image_url && story.image_url.includes('blob.core.windows.net')) {
        await deleteStoryImage(story.image_url);
      }
    }

    const [result] = await db.execute(
      'DELETE FROM stories WHERE expires_at <= ?',
      [now]
    );

    res.json({ 
      success: true,
      message: `Cleaned up ${result.affectedRows} expired stories` 
    });
  } catch (error) {
    console.error('Cleanup expired stories error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};
