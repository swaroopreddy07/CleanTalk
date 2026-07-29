const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../config/db');
const nodemailer = require('nodemailer');
const Redis = require('ioredis');

// Redis client for OTP storage
const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
});

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || '',
    },
  });
};

// ─── Send OTP for signup ───────────────────────────────────────────
const sendOTP = async (req, res) => {
  try {
    const { email, username } = req.body;

    if (!email || !username) {
      return res.status(400).json({ success: false, message: 'Email and username are required' });
    }

    // Check if user already exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or username'
      });
    }

    const otp = generateOTP();

    // Store OTP in Redis with 5-minute expiry
    await redis.setex(`otp:${email}`, 300, otp);

    // Send OTP email
    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"CleanTalk" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'CleanTalk - Email Verification OTP',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #000; color: #F5F5F5; border-radius: 8px;">
            <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 8px;">CleanTalk</h1>
            <p style="color: #A8A8A8; margin-bottom: 24px;">AI-Powered Safe Social Networking</p>
            <hr style="border: none; border-top: 1px solid #262626; margin: 16px 0;">
            <p>Hi <strong>${username}</strong>,</p>
            <p>Your verification code is:</p>
            <div style="background: #262626; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
              <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0095F6;">${otp}</span>
            </div>
            <p style="color: #A8A8A8; font-size: 14px;">This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
            <hr style="border: none; border-top: 1px solid #262626; margin: 24px 0;">
            <p style="color: #363636; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });

      console.log(`OTP sent to ${email}: ${otp}`);
    } catch (emailError) {
      console.error('Email sending failed:', emailError.message);
      // If email fails, log OTP to console for development/testing
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }

    res.json({
      success: true,
      message: 'OTP sent to your email'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Verify OTP ───────────────────────────────────────────────────
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const storedOTP = await redis.get(`otp:${email}`);

    if (!storedOTP) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    if (storedOTP !== otp.toString()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Mark email as verified in Redis (valid for 10 minutes to complete registration)
    await redis.setex(`verified:${email}`, 600, 'true');
    await redis.del(`otp:${email}`);

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Register (requires verified email) ───────────────────────────
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { username, email, password, display_name } = req.body;

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one symbol'
      });
    }

    // Check if email was verified via OTP
    const isVerified = await redis.get(`verified:${email}`);
    if (!isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email not verified. Please verify your email with OTP first.'
      });
    }

    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or username'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await db.execute(
      'INSERT INTO users (username, email, password, display_name) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, display_name || username]
    );

    // Clean up Redis verification flag
    await redis.del(`verified:${email}`);

    const token = generateToken(result.insertId);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: result.insertId,
        username,
        email,
        display_name: display_name || username
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [email, email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = generateToken(user.id);

    delete user.password;

    res.json({
      success: true,
      token,
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

const getMe = async (req, res) => {
  try {
    const [users] = await db.execute(
      `SELECT u.*, 
       (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count,
       (SELECT COUNT(*) FROM followers WHERE following_id = u.id) as followers_count,
       (SELECT COUNT(*) FROM followers WHERE follower_id = u.id) as following_count
       FROM users u WHERE u.id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    delete user.password;

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

module.exports = {
  sendOTP,
  verifyOTP,
  register,
  login,
  getMe
};