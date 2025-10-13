const db = require('../config/db');
const { uploadProfilePicture, deleteProfilePicture } = require('../services/azureStorage');

// Helper function to check if followers table has status column
const hasStatusColumn = async () => {
  try {
    const [columns] = await db.execute("SHOW COLUMNS FROM followers LIKE 'status'");
    return columns.length > 0;
  } catch {
    return false;
  }
};

// Helper function to build user query with follow status
const buildUserQuery = (hasStatus, joinFollowers = false) => {
  const baseSelect = `u.id, u.username, u.display_name, u.profile_picture, u.bio`;
  const counts = `
    (SELECT COUNT(*) FROM followers WHERE following_id = u.id ${hasStatus ? "AND status = 'accepted'" : ''}) as followers_count,
    (SELECT COUNT(*) FROM followers WHERE follower_id = u.id ${hasStatus ? "AND status = 'accepted'" : ''}) as following_count`;
  
  const followStatus = `
    CASE 
      ${hasStatus ? `WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id AND status = 'accepted') THEN 'accepted'
      WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id AND status = 'pending') THEN 'pending'` : `WHEN EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND following_id = u.id) THEN 'accepted'`}
      ELSE NULL
    END as follow_status`;

  return `SELECT ${baseSelect}, ${counts}, ${followStatus} FROM users u`;
};

const getUsers = async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, username, display_name, profile_picture, bio FROM users LIMIT 50'
    );
    res.json({ success: true, users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user.id;

    if (!q || q.trim().length === 0) {
      return res.json({ success: true, users: [] });
    }

    const hasStatus = await hasStatusColumn();
    const searchTerm = `%${q}%`;
    const query = `${buildUserQuery(hasStatus)}
      WHERE (u.username LIKE ? OR u.display_name LIKE ?) AND u.id != ?
      LIMIT 20`;

    const params = hasStatus 
      ? [currentUserId, currentUserId, searchTerm, searchTerm, currentUserId]
      : [currentUserId, searchTerm, searchTerm, currentUserId];

    const [users] = await db.execute(query, params);
    res.json({ success: true, users: users || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const hasStatus = await hasStatusColumn();

    const query = `${buildUserQuery(hasStatus)}, 
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count,
      u.website, u.created_at
      FROM users u WHERE u.username = ?`;

    const params = hasStatus ? [req.user.id, req.user.id, username] : [req.user.id, username];
    const [users] = await db.execute(query, params);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: users[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { display_name, bio, location, website, removeProfilePicture } = req.body;
    let profilePictureUrl = null;

    const [currentUser] = await db.execute(
      'SELECT profile_picture FROM users WHERE id = ?',
      [req.user.id]
    );

    if (removeProfilePicture === 'true' && currentUser[0]?.profile_picture) {
      if (currentUser[0].profile_picture.includes('blob.core.windows.net')) {
        await deleteProfilePicture(currentUser[0].profile_picture);
      }
      await db.execute('UPDATE users SET profile_picture = NULL WHERE id = ?', [req.user.id]);
    } else if (req.file) {
      profilePictureUrl = await uploadProfilePicture(req.file.buffer, req.file.originalname);
      if (currentUser[0]?.profile_picture?.includes('blob.core.windows.net')) {
        await deleteProfilePicture(currentUser[0].profile_picture);
      }
    }

    const query = profilePictureUrl
      ? 'UPDATE users SET display_name = ?, bio = ?, location = ?, website = ?, profile_picture = ? WHERE id = ?'
      : 'UPDATE users SET display_name = ?, bio = ?, location = ?, website = ? WHERE id = ?';

    const values = profilePictureUrl
      ? [display_name || '', bio || '', location || '', website || '', profilePictureUrl, req.user.id]
      : [display_name || '', bio || '', location || '', website || '', req.user.id];

    await db.execute(query, values);

    const [users] = await db.execute(
      'SELECT id, username, email, display_name, profile_picture, bio, location, website FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({ success: true, message: 'Profile updated successfully', user: users[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    if (followerId == userId) {
      return res.status(400).json({ success: false, message: 'Cannot follow yourself' });
    }

    const [existing] = await db.execute(
      'SELECT status FROM followers WHERE follower_id = ? AND following_id = ?',
      [followerId, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: existing[0].status === 'accepted' ? 'Already following' : 'Request already pending'
      });
    }

    await db.execute(
      'INSERT INTO followers (follower_id, following_id, status) VALUES (?, ?, ?)',
      [followerId, userId, 'pending']
    );

    await db.execute(
      'INSERT INTO notifications (user_id, sender_id, type) VALUES (?, ?, ?)',
      [userId, followerId, 'follow_request']
    );

    res.json({ success: true, message: 'Follow request sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const [result] = await db.execute(
      'DELETE FROM followers WHERE follower_id = ? AND following_id = ?',
      [req.user.id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'No follow relationship found' });
    }

    res.json({ success: true, message: 'Unfollowed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const hasStatus = await hasStatusColumn();
    const statusFilter = hasStatus ? "AND f.status = 'accepted'" : '';

    const query = `${buildUserQuery(hasStatus)}
      JOIN followers f ON u.id = f.follower_id
      WHERE f.following_id = ? ${statusFilter}
      ORDER BY f.created_at DESC`;

    const params = hasStatus ? [req.user.id, req.user.id, userId] : [req.user.id, userId];
    const [followers] = await db.execute(query, params);

    res.json({ success: true, followers: followers || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const hasStatus = await hasStatusColumn();
    const statusFilter = hasStatus ? "AND f.status = 'accepted'" : '';

    const query = `${buildUserQuery(hasStatus)}
      JOIN followers f ON u.id = f.following_id
      WHERE f.follower_id = ? ${statusFilter}
      ORDER BY f.created_at DESC`;

    const params = hasStatus ? [req.user.id, req.user.id, userId] : [req.user.id, userId];
    const [following] = await db.execute(query, params);

    res.json({ success: true, following: following || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

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
       WHERE u.id != ? AND u.id NOT IN (
         SELECT following_id FROM followers WHERE follower_id = ? AND status IN ('accepted', 'pending')
       )
       ORDER BY RAND() LIMIT 10`,
      [userId, userId, userId, userId]
    );

    res.json({ success: true, suggestions: suggestions || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getFollowRequests = async (req, res) => {
  try {
    const [requests] = await db.execute(
      `SELECT f.id, u.id as user_id, u.username, u.display_name, u.profile_picture, u.bio, f.created_at
       FROM followers f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, requests: requests || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const acceptFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const [request] = await db.execute(
      'SELECT follower_id FROM followers WHERE id = ? AND following_id = ? AND status = ?',
      [requestId, req.user.id, 'pending']
    );

    if (request.length === 0) {
      return res.status(404).json({ success: false, message: 'Follow request not found' });
    }

    await db.execute('UPDATE followers SET status = ? WHERE id = ?', ['accepted', requestId]);
    await db.execute(
      'INSERT INTO notifications (user_id, sender_id, type) VALUES (?, ?, ?)',
      [request[0].follower_id, req.user.id, 'follow_accepted']
    );

    res.json({ success: true, message: 'Follow request accepted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const rejectFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const [request] = await db.execute(
      'SELECT id FROM followers WHERE id = ? AND following_id = ? AND status = ?',
      [requestId, req.user.id, 'pending']
    );

    if (request.length === 0) {
      return res.status(404).json({ success: false, message: 'Follow request not found' });
    }

    await db.execute('DELETE FROM followers WHERE id = ?', [requestId]);
    res.json({ success: true, message: 'Follow request rejected' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
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