const { User, Product, Review, VendorReview } = require('../models');
const { attachVariantSummary } = require('../utils/productVariants');
const { getProductAttributes } = require('../utils/schemaSupport');

const getVendorStorefront = async (req, res, next) => {
  try {
    const vendor = await User.findOne({
      where: {
        id: req.params.id,
        role: 'vendor',
        isActive: true,
        isApproved: true,
      },
      attributes: ['id', 'name', 'email', 'phone', 'address', 'profileImage', 'createdAt'],
    });

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const products = await Product.findAll({
      attributes: await getProductAttributes(),
      where: {
        vendor_id: vendor.id,
        isActive: true,
      },
      include: [{ model: Review, as: 'reviews', attributes: ['rating'] }],
      order: [['createdAt', 'DESC']],
    });

    const vendorReviews = await VendorReview.findAll({
      where: { vendor_id: vendor.id },
      include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });

    const storefrontProducts = products.map((record) => {
      const product = attachVariantSummary(record.toJSON());
      const ratings = product.reviews.map((review) => review.rating);
      product.avgRating = ratings.length ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1) : 0;
      product.reviewCount = ratings.length;
      delete product.reviews;
      return product;
    });

    const ratingCount = storefrontProducts.reduce((sum, product) => sum + Number(product.reviewCount || 0), 0);
    const weightedRatings = storefrontProducts.reduce((sum, product) => (
      sum + (Number(product.avgRating || 0) * Number(product.reviewCount || 0))
    ), 0);
    const categories = [...new Set(storefrontProducts.map((product) => product.category).filter(Boolean))];
    const serializedVendorReviews = vendorReviews.map((review) => ({
      ...review.toJSON(),
      verifiedPurchase: true,
    }));
    const sellerReviewCount = serializedVendorReviews.length;
    const sellerAverageRating = sellerReviewCount
      ? Number((serializedVendorReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / sellerReviewCount).toFixed(1))
      : 0;

    res.json({
      success: true,
      vendor: vendor.toJSON(),
      stats: {
        totalProducts: storefrontProducts.length,
        totalCategories: categories.length,
        totalReviews: ratingCount,
        averageRating: ratingCount > 0 ? Number((weightedRatings / ratingCount).toFixed(1)) : 0,
        sellerReviewCount,
        sellerAverageRating,
      },
      vendorReviews: serializedVendorReviews,
      products: storefrontProducts,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVendorStorefront,
};
