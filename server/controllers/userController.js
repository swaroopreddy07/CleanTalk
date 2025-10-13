/**
 * User Controller
 * 
 * Handles all user-related operations including user management, authentication,
 * profile operations, follow/unfollow functionality, and user search.
 * 
 * Features:
 * - User CRUD operations
 * - Profile picture management with Azure Blob Storage
 * - Follow/Unfollow system with request states
 * - User search and suggestions
 * - Real-time notifications via Socket.IO
 * 
 * @author SocialConnect Team
 * @version 1.0.0
 */



const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { uploadProfilePicture, deleteProfilePicture } = require('../services/azureStorage');

/**
 * Get All Users
 * 
 * Retrieves a list of all users with basic profile information.
 * Used for admin purposes or general user discovery.
 * 
 * @route   GET /api/users
 * @access  Private
 * @returns {Object} List of users with basic profile information
 */
const getUsers = async (req, res) => {
  try {
    // Query to get basic user information (limited to 50 users for performance)
    const [users] = await db.execute(
      'SELECT id, username, display_name, profile_picture, bio FROM users LIMIT 50'
    );

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Search users
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user.id;

    if (!q || q.trim().length === 0) {
      return res.json({
        success: true,
        users: []
      });
    }

    const searchTerm = `%${q}%`;

    // Check if status column exists for follow request system compatibility
    let statusColumnExists = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM followers LIKE 'status'");
      statusColumnExists = columns.length > 0;
    } catch (error) {
      console.log('Could not check for status column:', error.message);
    }

    let query, params;
    if (statusColumnExists) {
      // Query with follow request system - check for accepted/pending status
      query = `SELECT u.id, u.username, u.display_name, u.profile_picture, u.bio,
       (SELECT COUNT(*) FROM followers WHERE following_id = u.id AND status = 'accepted') as followers_count,
       (SELECT COUNT(*) FROM followers WHERE follower_id = u.id AND status = 'accepted') as following_count,
       CASE 
         WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id AND status = 'accepted') THEN 'accepted'
         WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id AND status = 'pending') THEN 'pending'
         ELSE NULL
       END as follow_status
       FROM users u 
       WHERE (u.username LIKE ? OR u.display_name LIKE ?)
       AND u.id != ?
       LIMIT 20`;
      params = [currentUserId, currentUserId, searchTerm, searchTerm, currentUserId];
    } else {
      // Fallback query without status column (legacy compatibility)
      query = `SELECT u.id, u.username, u.display_name, u.profile_picture, u.bio,
       (SELECT COUNT(*) FROM followers WHERE following_id = u.id) as followers_count,
       (SELECT COUNT(*) FROM followers WHERE follower_id = u.id) as following_count,
       CASE 
         WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id) THEN 'accepted'
         ELSE NULL
       END as follow_status
       FROM users u 
       WHERE (u.username LIKE ? OR u.display_name LIKE ?)
       AND u.id != ?
       LIMIT 20`;
      params = [currentUserId, searchTerm, searchTerm, currentUserId];
    }

    const [users] = await db.execute(query, params);

    res.json({
      success: true,
      users: users || []
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user profile by username
// @route   GET /api/users/:username
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;

    // First check if status column exists
    let statusColumnExists = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM followers LIKE 'status'");
      statusColumnExists = columns.length > 0;
    } catch (error) {
      console.log('Could not check for status column:', error.message);
    }

    let query, params;
    if (statusColumnExists) {
      // Use the new query with status column
      query = `SELECT u.id, u.username, u.display_name, u.profile_picture, u.bio, u.website, u.created_at,
               (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count,
               (SELECT COUNT(*) FROM followers WHERE following_id = u.id AND status = 'accepted') as followers_count,
               (SELECT COUNT(*) FROM followers WHERE follower_id = u.id AND status = 'accepted') as following_count,
               CASE 
                 WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id AND status = 'accepted') THEN 'accepted'
                 WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id AND status = 'pending') THEN 'pending'
                 ELSE NULL
               END as follow_status
               FROM users u WHERE u.username = ?`;
      params = [req.user.id, req.user.id, username];
    } else {
      // Use the old query without status column
      query = `SELECT u.id, u.username, u.display_name, u.profile_picture, u.bio, u.website, u.created_at,
               (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count,
               (SELECT COUNT(*) FROM followers WHERE following_id = u.id) as followers_count,
               (SELECT COUNT(*) FROM followers WHERE follower_id = u.id) as following_count,
               CASE 
                 WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id) THEN 'accepted'
                 ELSE NULL
               END as follow_status
               FROM users u WHERE u.username = ?`;
      params = [req.user.id, username];
    }

    const [users] = await db.execute(query, params);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { display_name, bio, location, website, removeProfilePicture } = req.body;
    let profilePictureUrl = null;

    // Get current user data
    const [currentUser] = await db.execute(
      'SELECT profile_picture FROM users WHERE id = ?',
      [req.user.id]
    );

    // Handle profile picture removal
    if (removeProfilePicture === 'true') {
      if (currentUser[0].profile_picture) {
        // Delete from Azure if it's an Azure URL
        if (currentUser[0].profile_picture.includes('blob.core.windows.net')) {
          await deleteProfilePicture(currentUser[0].profile_picture);
        }
      }
      
      await db.execute(
        'UPDATE users SET profile_picture = NULL WHERE id = ?',
        [req.user.id]
      );
    }
    // Handle new profile picture upload
    else if (req.file) {
      // Upload to Azure
      profilePictureUrl = await uploadProfilePicture(
        req.file.buffer,
        req.file.originalname
      );

      // Delete old profile picture from Azure if exists
      if (currentUser[0].profile_picture && 
          currentUser[0].profile_picture.includes('blob.core.windows.net')) {
        await deleteProfilePicture(currentUser[0].profile_picture);
      }
    }

    let query = `UPDATE users SET display_name = ?, bio = ?, location = ?, website = ? WHERE id = ?`;
    let values = [display_name || '', bio || '', location || '', website || '', req.user.id];

    if (profilePictureUrl) {
      query = `UPDATE users SET display_name = ?, bio = ?, location = ?, website = ?, profile_picture = ? WHERE id = ?`;
      values = [display_name || '', bio || '', location || '', website || '', profilePictureUrl, req.user.id];
    }

    // Update user profile
    await db.execute(query, values);

    // Fetch updated user
    const [users] = await db.execute(
      'SELECT id, username, email, display_name, profile_picture, bio, location, website FROM users WHERE id = ?',
      [req.user.id]
    );

    const user = users[0];

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Follow a user (sends follow request)
// @route   POST /api/users/:userId/follow
// @access  Private
const followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    if (followerId == userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot follow yourself'
      });
    }

    // Check if already following or has pending request
    const [existing] = await db.execute(
      'SELECT id, status FROM followers WHERE follower_id = ? AND following_id = ?',
      [followerId, userId]
    );

    if (existing.length > 0) {
      const status = existing[0].status;
      if (status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Already following this user'
        });
      } else if (status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Follow request already pending'
        });
      }
    }

    // Add follow request (pending status)
    await db.execute(
      'INSERT INTO followers (follower_id, following_id, status) VALUES (?, ?, ?)',
      [followerId, userId, 'pending']
    );

    // Create notification
    await db.execute(
      'INSERT INTO notifications (user_id, sender_id, type) VALUES (?, ?, ?)',
      [userId, followerId, 'follow_request']
    );

    res.json({
      success: true,
      message: 'Follow request sent successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Unfollow a user or cancel pending request
// @route   DELETE /api/users/:userId/unfollow
// @access  Private
const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    // Delete the follow relationship (works for both accepted and pending)
    const [result] = await db.execute(
      'DELETE FROM followers WHERE follower_id = ? AND following_id = ?',
      [followerId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'No follow relationship found'
      });
    }

    res.json({
      success: true,
      message: 'Unfollowed successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get followers
// @route   GET /api/users/:userId/followers
// @access  Private
const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    // Check if status column exists
    let statusColumnExists = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM followers LIKE 'status'");
      statusColumnExists = columns.length > 0;
    } catch (error) {
      console.log('Could not check for status column:', error.message);
    }

    let query, params;
    if (statusColumnExists) {
      query = `SELECT u.id, u.username, u.display_name, u.profile_picture, u.bio,
               (SELECT COUNT(*) FROM followers WHERE following_id = u.id AND status = 'accepted') as followers_count,
               (SELECT COUNT(*) FROM followers WHERE follower_id = u.id AND status = 'accepted') as following_count,
               CASE 
                 WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id AND status = 'accepted') THEN 'accepted'
                 WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id AND status = 'pending') THEN 'pending'
                 ELSE NULL
               END as follow_status
               FROM users u
               JOIN followers f ON u.id = f.follower_id
               WHERE f.following_id = ? AND f.status = 'accepted'
               ORDER BY f.created_at DESC`;
      params = [currentUserId, currentUserId, userId];
    } else {
      query = `SELECT u.id, u.username, u.display_name, u.profile_picture, u.bio,
               (SELECT COUNT(*) FROM followers WHERE following_id = u.id) as followers_count,
               (SELECT COUNT(*) FROM followers WHERE follower_id = u.id) as following_count,
               CASE 
                 WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id) THEN 'accepted'
                 ELSE NULL
               END as follow_status
               FROM users u
               JOIN followers f ON u.id = f.follower_id
               WHERE f.following_id = ?
               ORDER BY f.created_at DESC`;
      params = [currentUserId, userId];
    }

    const [followers] = await db.execute(query, params);

    res.json({
      success: true,
      followers: followers || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get following
// @route   GET /api/users/:userId/following
// @access  Private
const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    // Check if status column exists
    let statusColumnExists = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM followers LIKE 'status'");
      statusColumnExists = columns.length > 0;
    } catch (error) {
      console.log('Could not check for status column:', error.message);
    }

    let query, params;
    if (statusColumnExists) {
      query = `SELECT u.id, u.username, u.display_name, u.profile_picture, u.bio,
               (SELECT COUNT(*) FROM followers WHERE following_id = u.id AND status = 'accepted') as followers_count,
               (SELECT COUNT(*) FROM followers WHERE follower_id = u.id AND status = 'accepted') as following_count,
               CASE 
                 WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id AND status = 'accepted') THEN 'accepted'
                 WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id AND status = 'pending') THEN 'pending'
                 ELSE NULL
               END as follow_status
               FROM users u
               JOIN followers f ON u.id = f.following_id
               WHERE f.follower_id = ? AND f.status = 'accepted'
               ORDER BY f.created_at DESC`;
      params = [currentUserId, currentUserId, userId];
    } else {
      query = `SELECT u.id, u.username, u.display_name, u.profile_picture, u.bio,
               (SELECT COUNT(*) FROM followers WHERE following_id = u.id) as followers_count,
               (SELECT COUNT(*) FROM followers WHERE follower_id = u.id) as following_count,
               CASE 
                 WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id) THEN 'accepted'
                 ELSE NULL
               END as follow_status
               FROM users u
               JOIN followers f ON u.id = f.following_id
               WHERE f.follower_id = ?
               ORDER BY f.created_at DESC`;
      params = [currentUserId, userId];
    }

    const [following] = await db.execute(query, params);

    res.json({
      success: true,
      following: following || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user suggestions
// @route   GET /api/users/suggestions
// @access  Private
const getSuggestions = async (req, res) => {
  try {
    const userId = req.user.id;

    const [suggestions] = await db.execute(
      `SELECT DISTINCT u.id, u.username, u.display_name, u.profile_picture, u.bio,
       (SELECT COUNT(*) FROM followers WHERE following_id = u.id AND status = 'accepted') as followers_count,
       (SELECT COUNT(*) FROM followers WHERE follower_id = u.id AND status = 'accepted') as following_count,
       CASE 
         WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id AND status = 'accepted') THEN 'accepted'
         WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id AND status = 'pending') THEN 'pending'
         ELSE NULL
       END as follow_status
       FROM users u
       WHERE u.id != ?
       AND u.id NOT IN (
         SELECT following_id FROM followers WHERE follower_id = ? AND status IN ('accepted', 'pending')
       )
       ORDER BY RAND()
       LIMIT 10`,
      [userId, userId, userId, userId]
    );

    res.json({
      success: true,
      suggestions: suggestions || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get follow requests for current user
// @route   GET /api/users/follow-requests
// @access  Private
const getFollowRequests = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const [requests] = await db.execute(
      `SELECT f.id, u.id as user_id, u.username, u.display_name, u.profile_picture, u.bio, f.created_at
       FROM followers f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [currentUserId]
    );

    res.json({
      success: true,
      requests: requests || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Accept a follow request
// @route   POST /api/users/follow-requests/:requestId/accept
// @access  Private
const acceptFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.user.id;

    // Verify the request belongs to current user and is pending
    const [request] = await db.execute(
      'SELECT follower_id FROM followers WHERE id = ? AND following_id = ? AND status = ?',
      [requestId, currentUserId, 'pending']
    );

    if (request.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Follow request not found'
      });
    }

    // Update status to accepted
    await db.execute(
      'UPDATE followers SET status = ? WHERE id = ?',
      ['accepted', requestId]
    );

    // Create notification for the requester
    await db.execute(
      'INSERT INTO notifications (user_id, sender_id, type) VALUES (?, ?, ?)',
      [request[0].follower_id, currentUserId, 'follow_accepted']
    );

    res.json({
      success: true,
      message: 'Follow request accepted'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Reject a follow request
// @route   POST /api/users/follow-requests/:requestId/reject
// @access  Private
const rejectFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.user.id;

    // Verify the request belongs to current user and is pending
    const [request] = await db.execute(
      'SELECT id FROM followers WHERE id = ? AND following_id = ? AND status = ?',
      [requestId, currentUserId, 'pending']
    );

    if (request.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Follow request not found'
      });
    }

    // Delete the request
    await db.execute(
      'DELETE FROM followers WHERE id = ?',
      [requestId]
    );

    res.json({
      success: true,
      message: 'Follow request rejected'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
module.exports = {
  getUsers,
  searchUsers,
  getUserProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getSuggestions,
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest
};