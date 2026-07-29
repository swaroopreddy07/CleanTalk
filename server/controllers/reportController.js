const db = require('../config/db');

exports.createReport = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { reported_user_id, reported_post_id, reported_comment_id, reason, description } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    if (!reported_user_id && !reported_post_id && !reported_comment_id) {
      return res.status(400).json({ success: false, message: 'Must report a user, post, or comment' });
    }

    const [result] = await db.execute(
      `INSERT INTO reports (reporter_id, reported_user_id, reported_post_id, reported_comment_id, reason, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [reporterId, reported_user_id || null, reported_post_id || null, reported_comment_id || null, reason, description || null]
    );

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully. We will review it shortly.',
      reportId: result.insertId,
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getReports = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || 'pending';

    const [reports] = await db.execute(
      `SELECT r.*, 
       u1.username as reporter_username,
       u2.username as reported_username,
       p.caption as reported_post_caption
       FROM reports r
       JOIN users u1 ON r.reporter_id = u1.id
       LEFT JOIN users u2 ON r.reported_user_id = u2.id
       LEFT JOIN posts p ON r.reported_post_id = p.id
       WHERE r.status = ?
       ORDER BY r.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [status]
    );

    res.json({ success: true, reports });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
