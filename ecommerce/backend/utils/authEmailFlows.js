const { UserSecurity } = require('../models');
const { createTokenPair } = require('./securityTokens');
const { sendEmail } = require('./email');

const frontendBaseUrl = () => (process.env.FRONTEND_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();

const buildUrl = (path, token) => `${frontendBaseUrl()}${path}?token=${encodeURIComponent(token)}`;

const getUserSecurity = async (userId, defaults = {}) => {
  const [security] = await UserSecurity.findOrCreate({
    where: { user_id: userId },
    defaults: {
      emailVerified: true,
      ...defaults,
    },
  });

  return security;
};

const createVerificationForUser = async (user) => {
  const { plainToken, hashedToken } = createTokenPair();
  const security = await getUserSecurity(user.id, { emailVerified: false });

  await security.update({
    emailVerified: false,
    emailVerificationTokenHash: hashedToken,
    emailVerificationExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
  });

  const verificationUrl = buildUrl('/verify-email', plainToken);

  await sendEmail({
    to: user.email,
    subject: 'Verify your ShopVault email',
    text: `Verify your ShopVault account by opening this link: ${verificationUrl}`,
    html: `<p>Verify your ShopVault account by clicking <a href="${verificationUrl}">this link</a>.</p>`,
  });

  return { verificationUrl };
};

const createPasswordResetForUser = async (user) => {
  const { plainToken, hashedToken } = createTokenPair();
  const security = await getUserSecurity(user.id);

  await security.update({
    passwordResetTokenHash: hashedToken,
    passwordResetExpiresAt: new Date(Date.now() + 1000 * 60 * 30),
  });

  const resetUrl = buildUrl('/reset-password', plainToken);

  await sendEmail({
    to: user.email,
    subject: 'Reset your ShopVault password',
    text: `Reset your ShopVault password by opening this link: ${resetUrl}`,
    html: `<p>Reset your ShopVault password by clicking <a href="${resetUrl}">this link</a>. This link expires in 30 minutes.</p>`,
  });

  return { resetUrl };
};

module.exports = { getUserSecurity, createVerificationForUser, createPasswordResetForUser };
