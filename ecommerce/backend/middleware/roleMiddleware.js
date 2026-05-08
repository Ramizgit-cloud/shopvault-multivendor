const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    // For vendors, check approval status
    if (req.user.role === 'vendor' && !req.user.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your vendor account is pending approval',
      });
    }
    next();
  };
};

module.exports = roleMiddleware;
