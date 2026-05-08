const express = require('express');
const router = express.Router();
const {
  createOrder, getMyOrders, getOrderById,
  getOrderMessages,
  getVendorOrders, requestOrderCancellation, resolveCancellationRequest,
  postOrderMessage,
  requestOrderReturn, resolveReturnRequest,
  updateOrderStatus, getVendorEarnings, getVendorPayouts, requestVendorPayout, markVendorPayoutPaidDemo, getAllOrders
} = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.post('/', authMiddleware, roleMiddleware('customer'), createOrder);
router.get('/my', authMiddleware, roleMiddleware('customer'), getMyOrders);
router.get('/vendor/orders', authMiddleware, roleMiddleware('vendor'), getVendorOrders);
router.get('/vendor/earnings', authMiddleware, roleMiddleware('vendor'), getVendorEarnings);
router.get('/vendor/payouts', authMiddleware, roleMiddleware('vendor'), getVendorPayouts);
router.post('/vendor/payouts/request', authMiddleware, roleMiddleware('vendor'), requestVendorPayout);
router.post('/vendor/payouts/:id/demo-mark-paid', authMiddleware, roleMiddleware('vendor'), markVendorPayoutPaidDemo);
router.get('/all', authMiddleware, roleMiddleware('admin'), getAllOrders);
router.get('/:id/messages', authMiddleware, getOrderMessages);
router.get('/:id', authMiddleware, getOrderById);
router.post('/:id/messages', authMiddleware, postOrderMessage);
router.put('/:id/request-cancel', authMiddleware, roleMiddleware('customer'), requestOrderCancellation);
router.put('/:id/cancel-decision', authMiddleware, roleMiddleware('vendor', 'admin'), resolveCancellationRequest);
router.put('/:id/request-return', authMiddleware, roleMiddleware('customer'), requestOrderReturn);
router.put('/:id/return-decision', authMiddleware, roleMiddleware('vendor', 'admin'), resolveReturnRequest);
router.put('/:id/status', authMiddleware, roleMiddleware('vendor', 'admin'), updateOrderStatus);

module.exports = router;
