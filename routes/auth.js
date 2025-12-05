const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');
const {
  sendOtp,
  verifyOtp,
  getCurrentUser,
  getAllUsers,
  updateUserCredits
} = require('../controllers/authController');

const router = express.Router();

// Rate limiter for OTP requests - 3 requests per 2 minutes per IP
const otpRateLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 3, // 3 requests per window
  message: { error: 'Too many OTP requests. Please wait 2 minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth routes
router.post('/send-otp', otpRateLimiter, sendOtp);
router.post('/verify-otp', verifyOtp);
router.get('/me', authMiddleware, getCurrentUser);

// Admin routes
router.get('/users', authMiddleware, getAllUsers);
router.patch('/users/:userId/credits', authMiddleware, updateUserCredits);

module.exports = router;
