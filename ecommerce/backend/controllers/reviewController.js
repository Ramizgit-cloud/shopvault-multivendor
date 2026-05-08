const { Review, VendorReview, User, Product, Order, OrderItem } = require('../models');
const { getProductAttributes } = require('../utils/schemaSupport');

const parseRating = (value) => Number.parseInt(value, 10);

const hasDeliveredPurchase = async (userId, productId) => {
  const deliveredItem = await OrderItem.findOne({
    where: { product_id: productId },
    include: [{
      model: Order,
      as: 'order',
      where: { user_id: userId, status: 'delivered' },
      attributes: ['id'],
    }],
    attributes: ['id'],
  });

  return Boolean(deliveredItem);
};

const hasDeliveredVendorPurchase = async (userId, vendorId) => {
  const deliveredItem = await OrderItem.findOne({
    where: { vendor_id: vendorId },
    include: [{
      model: Order,
      as: 'order',
      where: { user_id: userId, status: 'delivered' },
      attributes: ['id'],
    }],
    attributes: ['id'],
  });

  return Boolean(deliveredItem);
};

// POST /api/reviews
const createReview = async (req, res, next) => {
  try {
    const { product_id, comment } = req.body;
    const rating = parseRating(req.body.rating);

    if (!product_id || !rating) {
      return res.status(400).json({ success: false, message: 'Product ID and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const product = await Product.findByPk(product_id, {
      attributes: await getProductAttributes(),
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const canReview = await hasDeliveredPurchase(req.user.id, product_id);
    if (!canReview) {
      return res.status(403).json({
        success: false,
        message: 'Only customers with a delivered order can review this product',
      });
    }

    const existing = await Review.findOne({ where: { user_id: req.user.id, product_id } });
    if (existing) {
      await existing.update({ rating, comment });
      return res.json({ success: true, message: 'Review updated', review: existing });
    }

    const review = await Review.create({ user_id: req.user.id, product_id, rating, comment });
    res.status(201).json({ success: true, message: 'Review added', review });
  } catch (error) {
    next(error);
  }
};

// PUT /api/reviews/:id
const updateReview = async (req, res, next) => {
  try {
    const rating = parseRating(req.body.rating);
    const { comment } = req.body;
    const review = await Review.findByPk(req.params.id);

    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    if (review.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (!rating) {
      return res.status(400).json({ success: false, message: 'Rating is required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    await review.update({ rating, comment });
    res.json({ success: true, message: 'Review updated', review });
  } catch (error) {
    next(error);
  }
};

// GET /api/reviews/product/:id
const getProductReviews = async (req, res, next) => {
  try {
    const deliveredOrders = await OrderItem.findAll({
      where: { product_id: req.params.id },
      include: [{
        model: Order,
        as: 'order',
        where: { status: 'delivered' },
        attributes: ['user_id'],
      }],
      attributes: ['product_id'],
    });
    const verifiedReviewerIds = new Set(deliveredOrders.map((item) => Number(item.order?.user_id)).filter(Boolean));

    const reviews = await Review.findAll({
      where: { product_id: req.params.id },
      include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({
      success: true,
      reviews: reviews.map((review) => {
        const record = review.toJSON();
        return {
          ...record,
          verifiedPurchase: verifiedReviewerIds.has(Number(record.user_id)),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/reviews/vendor
const createVendorReview = async (req, res, next) => {
  try {
    const { vendor_id, comment } = req.body;
    const rating = parseRating(req.body.rating);

    if (!vendor_id || !rating) {
      return res.status(400).json({ success: false, message: 'Vendor ID and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const vendor = await User.findOne({
      where: { id: vendor_id, role: 'vendor', isActive: true, isApproved: true },
      attributes: ['id', 'name'],
    });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const canReview = await hasDeliveredVendorPurchase(req.user.id, vendor_id);
    if (!canReview) {
      return res.status(403).json({
        success: false,
        message: 'Only customers with a delivered order from this seller can review this store',
      });
    }

    const existing = await VendorReview.findOne({ where: { user_id: req.user.id, vendor_id } });
    if (existing) {
      await existing.update({ rating, comment });
      return res.json({ success: true, message: 'Seller review updated', review: existing });
    }

    const review = await VendorReview.create({ user_id: req.user.id, vendor_id, rating, comment });
    res.status(201).json({ success: true, message: 'Seller review added', review });
  } catch (error) {
    next(error);
  }
};

// PUT /api/reviews/vendor/:id
const updateVendorReview = async (req, res, next) => {
  try {
    const rating = parseRating(req.body.rating);
    const { comment } = req.body;
    const review = await VendorReview.findByPk(req.params.id);

    if (!review) return res.status(404).json({ success: false, message: 'Seller review not found' });
    if (review.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (!rating) {
      return res.status(400).json({ success: false, message: 'Rating is required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    await review.update({ rating, comment });
    res.json({ success: true, message: 'Seller review updated', review });
  } catch (error) {
    next(error);
  }
};

// GET /api/reviews/vendor/:id
const getVendorReviews = async (req, res, next) => {
  try {
    const deliveredItems = await OrderItem.findAll({
      where: { vendor_id: req.params.id },
      include: [{
        model: Order,
        as: 'order',
        where: { status: 'delivered' },
        attributes: ['user_id'],
      }],
      attributes: ['vendor_id'],
    });
    const verifiedReviewerIds = new Set(deliveredItems.map((item) => Number(item.order?.user_id)).filter(Boolean));

    const reviews = await VendorReview.findAll({
      where: { vendor_id: req.params.id },
      include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      reviews: reviews.map((review) => {
        const record = review.toJSON();
        return {
          ...record,
          verifiedPurchase: verifiedReviewerIds.has(Number(record.user_id)),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/reviews/:id
const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    if (req.user.role !== 'admin' && review.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await review.destroy();
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/reviews/vendor/:id
const deleteVendorReview = async (req, res, next) => {
  try {
    const review = await VendorReview.findByPk(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Seller review not found' });

    if (req.user.role !== 'admin' && review.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await review.destroy();
    res.json({ success: true, message: 'Seller review deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  updateReview,
  getProductReviews,
  deleteReview,
  createVendorReview,
  updateVendorReview,
  getVendorReviews,
  deleteVendorReview,
};
