const { Op } = require('sequelize');
const { User, UserSecurity } = require('../models');
const { generateToken } = require('../utils/jwt');
const { hashToken } = require('../utils/securityTokens');
const { createVerificationForUser, createPasswordResetForUser } = require('../utils/authEmailFlows');
const { normalizeEmail, isValidEmail } = require('../utils/emailValidation');

const ensureSecurityRecord = async (user, defaults = {}) => {
  const [security] = await UserSecurity.findOrCreate({
    where: { user_id: user.id },
    defaults: {
      emailVerified: !!user.email ? false : true,
      phoneVerified: true,
      ...defaults,
    },
  });

  return security;
};

const serializeUser = async (user) => {
  const security = await ensureSecurityRecord(user);

  return {
    ...user.toJSON(),
    emailVerified: security.emailVerified,
    phoneVerified: security.phoneVerified,
  };
};

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, password, role, phone, address } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const allowedRoles = ['customer', 'vendor'];
    const userRole = allowedRoles.includes(role) ? role : 'customer';

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
      phone,
      address,
      isApproved: userRole === 'customer',
    });

    await ensureSecurityRecord(user, { emailVerified: false, phoneVerified: true });
    await createVerificationForUser(user);

    res.status(201).json({
      success: true,
      message: userRole === 'vendor'
        ? 'Registration successful. Verify your email and wait for admin approval.'
        : 'Registration successful. Check your email to verify your account.',
      user: await serializeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact admin.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: await serializeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/verify-email
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    const security = await UserSecurity.findOne({
      where: {
        emailVerificationTokenHash: hashToken(token),
        emailVerificationExpiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!security) {
      return res.status(400).json({ success: false, message: 'Verification link is invalid or expired' });
    }

    await security.update({
      emailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    });

    res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/resend-verification
const resendVerificationEmail = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.json({ success: true, message: 'If the account exists, a verification email has been sent.' });
    }

    const security = await ensureSecurityRecord(user);
    if (security.emailVerified) {
      return res.json({ success: true, message: 'This email is already verified.' });
    }

    await createVerificationForUser(user);
    res.json({ success: true, message: 'Verification email sent. Check your inbox.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }

    const user = await User.findOne({ where: { email } });
    if (user) {
      await createPasswordResetForUser(user);
    }

    res.json({ success: true, message: 'If the account exists, a password reset email has been sent.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const security = await UserSecurity.findOne({
      where: {
        passwordResetTokenHash: hashToken(token),
        passwordResetExpiresAt: { [Op.gt]: new Date() },
      },
      include: [{ model: User, as: 'user' }],
    });

    if (!security || !security.user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or expired' });
    }

    await security.user.update({ password });
    await security.update({
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });

    res.json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    res.json({ success: true, user: await serializeUser(user) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address, profileImage, billingName, gstin } = req.body;
    const user = await User.findByPk(req.user.id);
    await user.update({ name, phone, address, profileImage, billingName, gstin });
    res.json({ success: true, message: 'Profile updated', user: await serializeUser(user) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    await user.update({ password: newPassword });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  changePassword,
};
