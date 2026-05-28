const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Registration Route
router.post('/register', authController.register);

// OTP Verification Route
router.post('/verify-otp', authController.verifyOtp);

// Login Route
router.post('/login', authController.login);

// Forgot Password (Initiate) Route
router.post('/forgot-password', authController.forgotPassword);

// Reset Password (Complete) Route
router.post('/reset-password', authController.resetPassword);

// Get User Profile Route
const authMiddleware = require('../middleware/auth');
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;
