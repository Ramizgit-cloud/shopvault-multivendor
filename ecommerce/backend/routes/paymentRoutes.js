const express = require('express');
const router = express.Router();
const { getPaymentConfig, createRazorpayOrder, verifyPayment, completeDemoPayment } = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { paymentLimiter } = require('../middleware/rateLimitMiddleware');
const { blockDemoRouteInProduction } = require('../middleware/securityMiddleware');

router.get('/config', getPaymentConfig);
router.post('/create-order', paymentLimiter, authMiddleware, roleMiddleware('customer'), createRazorpayOrder);
router.post('/verify', paymentLimiter, authMiddleware, roleMiddleware('customer'), verifyPayment);
router.post('/demo-complete', blockDemoRouteInProduction, authMiddleware, roleMiddleware('customer'), completeDemoPayment);

module.exports = router;
