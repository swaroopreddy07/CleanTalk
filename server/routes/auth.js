const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, register, login, getMe } = require('../controllers/authController');
const protect = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3 }).trim(),
  body('password').isLength({ min: 8 }),
  body('display_name').optional().trim()
];

const loginValidation = [
  body('email').notEmpty(),
  body('password').isLength({ min: 6 })
];

// Public routes
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);

// Protected routes
router.get('/me', protect, getMe);

module.exports = router;