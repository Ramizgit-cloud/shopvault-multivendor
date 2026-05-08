const express = require('express');
const router = express.Router();
const { validateCouponForCart } = require('../controllers/couponController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.post('/validate', authMiddleware, roleMiddleware('customer'), validateCouponForCart);

module.exports = router;
