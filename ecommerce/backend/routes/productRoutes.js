const express = require('express');
const router = express.Router();
const {
  getAllProducts, getProductById, createProduct,
  updateProduct, deleteProduct, getVendorProducts, getVendorRestockHistoryFeed, getCategories, getBrands, getProductSearchSuggestions, toggleTemporarilyUnavailable
} = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get('/', getAllProducts);
router.get('/search-suggestions', getProductSearchSuggestions);
router.get('/categories', getCategories);
router.get('/brands', getBrands);
router.get('/vendor/my-products', authMiddleware, roleMiddleware('vendor'), getVendorProducts);
router.get('/vendor/restock-history', authMiddleware, roleMiddleware('vendor'), getVendorRestockHistoryFeed);
router.get('/:id', getProductById);
router.post('/', authMiddleware, roleMiddleware('vendor', 'admin'), createProduct);
router.put('/:id', authMiddleware, roleMiddleware('vendor', 'admin'), updateProduct);
router.patch('/:id/temporarily-unavailable', authMiddleware, roleMiddleware('vendor', 'admin'), toggleTemporarilyUnavailable);
router.delete('/:id', authMiddleware, roleMiddleware('vendor', 'admin'), deleteProduct);

module.exports = router;
