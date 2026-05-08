const express = require('express');
const router = express.Router();
const {
  getDashboard, getAllUsers, toggleUserStatus, blockUserAdmin, deleteUserAdmin,
  approveVendor, approveVendorAlias, getAllVendors, blockVendor,
  getAllProductsAdmin, deleteProductAdmin, deleteProductAdminAlias,
  getAllOrdersAdmin, setOrderReviewFlag, getAllPaymentsAdmin, getAllReviewsAdmin, deleteReviewAdmin,
} = require('../controllers/adminController');
const {
  getAllCoupons, createCoupon, updateCoupon, toggleCouponStatus,
} = require('../controllers/couponController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// All admin routes require auth + admin role
router.use(authMiddleware, roleMiddleware('admin'));

router.get('/dashboard', getDashboard);
router.get('/users', getAllUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.delete('/user/:id', deleteUserAdmin);
router.put('/user/block/:id', blockUserAdmin);
router.get('/vendors', getAllVendors);
router.put('/vendors/:id/approve', approveVendor);
router.put('/vendor/approve/:id', approveVendorAlias);
router.put('/vendor/block/:id', blockVendor);
router.get('/products', getAllProductsAdmin);
router.delete('/products/:id', deleteProductAdmin);
router.delete('/product/:id', deleteProductAdminAlias);
router.get('/orders', getAllOrdersAdmin);
router.put('/orders/:id/review-flag', setOrderReviewFlag);
router.get('/payments', getAllPaymentsAdmin);
router.get('/reviews', getAllReviewsAdmin);
router.delete('/reviews/:id', deleteReviewAdmin);
router.get('/coupons', getAllCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.put('/coupons/:id/toggle-status', toggleCouponStatus);

module.exports = router;
