const express = require('express');
const router = express.Router();
const {
  register,
  login,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  changePassword,
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', passwordResetLimiter, resendVerificationEmail);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, updateProfile);
router.put('/change-password', authMiddleware, passwordResetLimiter, changePassword);

module.exports = router;
