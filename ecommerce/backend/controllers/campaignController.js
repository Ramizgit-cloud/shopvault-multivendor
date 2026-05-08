const { Product, VendorCampaign } = require('../models');
const { evaluateCampaignPricing } = require('../utils/vendorCampaigns');

const previewCampaignPricing = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.cart_items) ? req.body.cart_items : [];

    if (!items.length) {
      return res.json({
        success: true,
        pricing: {
          subtotal: 0,
          discountAmount: 0,
          finalTotal: 0,
          appliedCampaigns: [],
          lineAdjustments: [],
        },
      });
    }

    const productIds = [...new Set(items.map((item) => Number(item.product_id || item.id)).filter(Boolean))];
    const products = await Product.findAll({
      where: { id: productIds, isActive: true },
      attributes: ['id', 'name', 'price', 'vendor_id', 'category'],
    });
    const vendorIds = [...new Set(products.map((product) => Number(product.vendor_id)).filter(Boolean))];
    const campaigns = vendorIds.length ? await VendorCampaign.findAll({
      where: {
        vendor_id: vendorIds,
      },
      order: [['createdAt', 'DESC']],
    }) : [];

    const pricing = evaluateCampaignPricing({ items, products, campaigns });
    res.json({ success: true, pricing });
  } catch (error) {
    next(error);
  }
};

module.exports = { previewCampaignPricing };
