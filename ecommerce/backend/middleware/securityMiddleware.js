const isProduction = process.env.NODE_ENV === 'production';

const securityHeaders = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
    );
  }

  next();
};

const blockDemoRouteInProduction = (_req, res, next) => {
  if (isProduction) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }

  return next();
};

module.exports = { securityHeaders, blockDemoRouteInProduction };
