const { Wishlist, Product, User, Review } = require('../models');
const { getProductAttributes } = require('../utils/schemaSupport');

const withRatings = (productModel) => {
  const product = productModel.toJSON();
  const ratings = product.reviews.map((review) => review.rating);
  product.avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 0;
  product.reviewCount = ratings.length;
  delete product.reviews;
  return product;
};

const getWishlist = async (req, res, next) => {
  try {
    const wishlistItems = await Wishlist.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: await getProductAttributes(),
          where: { isActive: true },
          include: [
            { model: User, as: 'vendor', attributes: ['id', 'name', 'email'] },
            { model: Review, as: 'reviews', attributes: ['rating'] },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const products = wishlistItems.map((item) => {
      const product = withRatings(item.product);
      product.wishlistItemId = item.id;
      return product;
    });

    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
};

const addToWishlist = async (req, res, next) => {
  try {
    const { product_id } = req.body;
    if (!product_id) {
      return res.status(400).json({ success: false, message: 'Product is required' });
    }

    const product = await Product.findOne({
      attributes: await getProductAttributes(),
      where: { id: product_id, isActive: true },
      include: [
        { model: User, as: 'vendor', attributes: ['id', 'name', 'email'] },
        { model: Review, as: 'reviews', attributes: ['rating'] },
      ],
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const [wishlistItem, created] = await Wishlist.findOrCreate({
      where: { user_id: req.user.id, product_id },
      defaults: { user_id: req.user.id, product_id },
    });

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Added to wishlist' : 'Already in wishlist',
      product: withRatings(product),
      wishlistItemId: wishlistItem.id,
    });
  } catch (error) {
    next(error);
  }
};

const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const deleted = await Wishlist.destroy({
      where: { user_id: req.user.id, product_id: productId },
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Wishlist item not found' });
    }

    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
