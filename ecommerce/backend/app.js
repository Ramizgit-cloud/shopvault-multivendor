const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const adminRoutes = require('./routes/adminRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const couponRoutes = require('./routes/couponRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const supportRoutes = require('./routes/supportRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const errorHandler = require('./middleware/errorHandler');
const { securityHeaders } = require('./middleware/securityMiddleware');

const app = express();

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_APP_URL,
]
  .filter(Boolean)
  .flatMap((value) => value.split(','))
  .map((origin) => origin.trim())
  .filter(Boolean);

const developmentOrigins = process.env.NODE_ENV === 'production' ? [] : [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:5001',
];

const allowedOrigins = Array.from(new Set([
  ...configuredOrigins,
  ...developmentOrigins,
]));

const isLocalDevelopmentOrigin = (origin) => (
  process.env.NODE_ENV !== 'production' &&
  /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
);

// Middleware
app.use(securityHeaders);
app.use(cors({
  origin(origin, callback) {
    // Allow server-to-server tools and same-origin requests without an Origin header.
    if (!origin) {
      callback(null, true);
      return;
    }

    // Helpful for local testing when someone opens frontend/build/index.html directly.
    if (origin === 'null' && process.env.NODE_ENV !== 'production') {
      callback(null, origin);
      return;
    }

    if (allowedOrigins.includes(origin) || isLocalDevelopmentOrigin(origin)) {
      callback(null, origin);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logger (dev)
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/vendors', vendorRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// 404
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error handler
app.use(errorHandler);

module.exports = app;
