const express = require('express');
const router = express.Router();
const { createRazorpayOrder, verifyPayment, completeDemoPayment } = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.post('/create-order', authMiddleware, roleMiddleware('customer'), createRazorpayOrder);
router.post('/verify', authMiddleware, roleMiddleware('customer'), verifyPayment);
router.post('/demo-complete', authMiddleware, roleMiddleware('customer'), completeDemoPayment);

module.exports = router;
