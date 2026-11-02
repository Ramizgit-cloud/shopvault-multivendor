const isPlaceholder = (value) => !value || /^your_|dummy|changeme|change_this/i.test(String(value));

const validateEnvironment = () => {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET', 'FRONTEND_URL'];
  const missing = required.filter((key) => isPlaceholder(process.env[key]));

  if (String(process.env.JWT_SECRET || '').length < 32) {
    missing.push('JWT_SECRET must be at least 32 characters');
  }

  if (process.env.DB_SYNC === 'true' && process.env.DB_SYNC_ALTER === 'true') {
    missing.push('DB_SYNC_ALTER must not be true in production');
  }

  if (isPlaceholder(process.env.RAZORPAY_KEY_ID) || isPlaceholder(process.env.RAZORPAY_KEY_SECRET)) {
    missing.push('RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET');
  }

  if (missing.length) {
    throw new Error(`Production environment is not ready: ${missing.join(', ')}`);
  }
};

module.exports = { validateEnvironment };
