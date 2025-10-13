const db = require('../config/db');

const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const [conversations] = await db.query(
      `SELECT DISTINCT
        CASE 
          WHEN m.sender_id = ? THEN m.receiver_id 
          ELSE m.sender_id 
        END as user_id
       FROM messages m
       WHERE (m.sender_id = ? OR m.receiver_id = ?) 
         AND NOT (m.sender_id = ? AND m.receiver_id = ?)`,
      [userId, userId, userId, userId, userId]
    );

    const conversationDetails = await Promise.all(
      conversations.map(async (conv) => {
        const [users] = await db.query(
          'SELECT id, username, display_name, profile_picture FROM users WHERE id = ?',
          [conv.user_id]
        );

        if (users.length === 0) return null;

        const [lastMessages] = await db.query(
          `SELECT content, created_at, sender_id
           FROM messages
           WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, conv.user_id, conv.user_id, userId]
        );

        const [unreadCount] = await db.query(
          `SELECT COUNT(*) as count
           FROM messages
           WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
          [conv.user_id, userId]
        );

        return {
          user_id: users[0].id,
          username: users[0].username,
          display_name: users[0].display_name,
          profile_picture: users[0].profile_picture,
          last_message: lastMessages[0]?.content || null,
          last_message_time: lastMessages[0]?.created_at || null,
          unread_count: unreadCount[0].count || 0
        };
      })
    );

    const validConversations = conversationDetails
      .filter(conv => conv !== null)
      .sort((a, b) => new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0));

    res.json({ success: true, data: validConversations });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userId: otherUserId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (userId === parseInt(otherUserId)) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    const [users] = await db.query('SELECT id FROM users WHERE id = ?', [otherUserId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [messages] = await db.query(
      `SELECT m.*, 
       s.username as sender_username,
       s.profile_picture as sender_profile_picture,
       s.display_name as sender_display_name
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       WHERE (m.sender_id = ? AND m.receiver_id = ?) 
          OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.created_at ASC
       LIMIT ? OFFSET ?`,
      [userId, otherUserId, otherUserId, userId, parseInt(limit), parseInt(offset)]
    );

    await db.query(
      'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [otherUserId, userId]
    );

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, content } = req.body;

    if (!receiverId || !content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Receiver and content are required' });
    }

    if (senderId === parseInt(receiverId)) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    const [users] = await db.query('SELECT id FROM users WHERE id = ?', [receiverId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Receiver not found' });
    }

    const [result] = await db.query(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
      [senderId, receiverId, content]
    );

    const [messages] = await db.query(
      `SELECT m.*, 
       s.username as sender_username,
       s.profile_picture as sender_profile_picture,
       s.display_name as sender_display_name
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, data: messages[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userId: senderId } = req.params;

    if (userId === parseInt(senderId)) {
      return res.status(400).json({ success: false, message: 'Invalid operation' });
    }

    await db.query(
      'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [senderId, userId]
    );

    res.json({ success: true, message: 'All messages marked as read' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const [result] = await db.query(
      'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0',
      [req.user.id]
    );

    res.json({ success: true, count: result[0].count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  markAllAsRead,
  getUnreadCount
};