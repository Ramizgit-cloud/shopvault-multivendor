const express = require('express');
const router = express.Router();
const {
  createReview,
  updateReview,
  getProductReviews,
  deleteReview,
  createVendorReview,
  updateVendorReview,
  getVendorReviews,
  deleteVendorReview,
} = require('../controllers/reviewController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.post('/', authMiddleware, roleMiddleware('customer'), createReview);
router.post('/vendor', authMiddleware, roleMiddleware('customer'), createVendorReview);
router.put('/:id', authMiddleware, roleMiddleware('customer'), updateReview);
router.put('/vendor/:id', authMiddleware, roleMiddleware('customer'), updateVendorReview);
router.get('/product/:id', getProductReviews);
router.get('/vendor/:id', getVendorReviews);
router.delete('/:id', authMiddleware, deleteReview);
router.delete('/vendor/:id', authMiddleware, deleteVendorReview);

module.exports = router;
