const buckets = new Map();

const getClientKey = (req, scope) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown';
  const accountKey = String(req.body?.email || req.body?.order_id || '').toLowerCase().trim();
  return `${scope}:${ip}:${accountKey}`;
};

const makeRateLimiter = ({ windowMs, max, scope }) => (req, res, next) => {
  const now = Date.now();
  const key = getClientKey(req, scope);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  current.count += 1;

  if (current.count > max) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  }

  return next();
};

const pruneExpiredBuckets = () => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

setInterval(pruneExpiredBuckets, 5 * 60 * 1000).unref();

module.exports = {
  authLimiter: makeRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, scope: 'auth' }),
  passwordResetLimiter: makeRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, scope: 'password-reset' }),
  paymentLimiter: makeRateLimiter({ windowMs: 10 * 60 * 1000, max: 30, scope: 'payment' }),
};
