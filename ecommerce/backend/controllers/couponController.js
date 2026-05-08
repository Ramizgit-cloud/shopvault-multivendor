const { Coupon, CouponRedemption, User } = require('../models');
const { sequelize } = require('../config/database');
const { validateCoupon, buildCouponStatusMeta, normalizeCouponPayload } = require('../utils/coupon');
const { evaluateCampaignPricing } = require('../utils/vendorCampaigns');
const { Product, VendorCampaign } = require('../models');

const serializeCoupon = (coupon) => ({
  id: coupon.id,
  code: coupon.code,
  description: coupon.description,
  discount_type: coupon.discount_type,
  discount_value: coupon.discount_value,
  min_order_amount: coupon.min_order_amount,
  max_discount: coupon.max_discount,
  usage_limit: coupon.usage_limit,
  used_count: coupon.used_count,
  starts_at: coupon.starts_at,
  expires_at: coupon.expires_at,
  is_active: coupon.is_active,
  vendor_id: coupon.vendor_id,
  usage_limit_per_user: coupon.usage_limit_per_user,
  vendor: coupon.vendor ? {
    id: coupon.vendor.id,
    name: coupon.vendor.name,
    email: coupon.vendor.email,
  } : null,
  status: buildCouponStatusMeta(coupon),
  createdAt: coupon.createdAt,
  updatedAt: coupon.updatedAt,
});

const validateCouponForCart = async (req, res, next) => {
  try {
    const { code, cart_total, cart_items = [] } = req.body;
    const productIds = [...new Set(cart_items.map((item) => Number(item.product_id || item.id)).filter(Boolean))];
    const products = productIds.length ? await Product.findAll({
      where: { id: productIds, isActive: true },
      attributes: ['id', 'name', 'price', 'vendor_id', 'category'],
    }) : [];
    const vendorIds = [...new Set(products.map((product) => Number(product.vendor_id)).filter(Boolean))];
    const campaigns = vendorIds.length ? await VendorCampaign.findAll({
      where: { vendor_id: vendorIds },
      order: [['createdAt', 'DESC']],
    }) : [];
    const campaignPricing = evaluateCampaignPricing({
      items: cart_items,
      products,
      campaigns,
    });
    const result = await validateCoupon({
      code,
      cartTotal: campaignPricing.finalTotal ?? cart_total,
      items: cart_items,
      userId: req.user.id,
    });

    res.json({
      success: true,
      coupon: serializeCoupon(result.coupon),
      discountAmount: result.discountAmount,
      finalTotal: result.finalTotal,
      eligibleSubtotal: result.eligibleSubtotal,
      scopeLabel: result.scopeLabel,
      campaignPricing,
    });
  } catch (error) {
    next(error);
  }
};

const getAllCoupons = async (_req, res, next) => {
  try {
    const coupons = await Coupon.findAll({
      include: [{ model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
    });
    const [analyticsRows] = await sequelize.query(`
      SELECT
        COUNT(*) as total_coupons,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_coupons,
        COALESCE(SUM(used_count), 0) as total_redemptions
      FROM coupons
    `);

    const [impactRows] = await sequelize.query(`
      SELECT
        ROUND(COALESCE(SUM(cr.discount_amount), 0), 2) as total_discount_given,
        ROUND(COALESCE(AVG(cr.discount_amount), 0), 2) as avg_discount_value,
        ROUND(COALESCE(SUM(CASE WHEN cr.is_consumed = 1 THEN cr.original_total - cr.discount_amount END), 0), 2) as revenue_after_discount
      FROM coupon_redemptions cr
    `);

    const [topCoupons] = await sequelize.query(`
      SELECT
        c.id,
        c.code,
        c.discount_type,
        c.discount_value,
        c.used_count,
        ROUND(COALESCE(SUM(cr.discount_amount), 0), 2) as total_discount,
        ROUND(COALESCE(SUM(CASE WHEN cr.is_consumed = 1 THEN cr.original_total - cr.discount_amount END), 0), 2) as net_revenue,
        ROUND(COALESCE(AVG(cr.discount_amount), 0), 2) as avg_discount,
        MAX(cr.createdAt) as last_used_at
      FROM coupons c
      LEFT JOIN coupon_redemptions cr ON cr.coupon_id = c.id
      GROUP BY c.id, c.code, c.discount_type, c.discount_value, c.used_count
      ORDER BY c.used_count DESC, total_discount DESC, c.createdAt DESC
      LIMIT 5
    `);

    const recentRedemptions = await CouponRedemption.findAll({
      limit: 6,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'coupon_code', 'discount_amount', 'original_total', 'is_consumed', 'createdAt', 'vendor_id'],
      include: [{ model: User, as: 'vendor', attributes: ['id', 'name'] }],
    });

    const now = new Date();
    const statusBuckets = coupons.reduce((acc, coupon) => {
      const lifecycle = buildCouponStatusMeta(coupon).lifecycle;
      acc[lifecycle] = (acc[lifecycle] || 0) + 1;
      if (coupon.vendor_id) acc.vendorScoped += 1;
      else acc.platformScoped += 1;
      if (coupon.expires_at) {
        const diffDays = Math.ceil((new Date(coupon.expires_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays >= 0 && diffDays <= 7) acc.expiringSoon += 1;
      }
      return acc;
    }, {
      active: 0,
      scheduled: 0,
      expired: 0,
      inactive: 0,
      used_up: 0,
      vendorScoped: 0,
      platformScoped: 0,
      expiringSoon: 0,
    });

    const vendorBreakdown = coupons
      .filter((coupon) => coupon.vendor_id)
      .reduce((acc, coupon) => {
        const key = coupon.vendor_id;
        if (!acc[key]) {
          acc[key] = {
            vendor_id: coupon.vendor_id,
            vendor_name: coupon.vendor?.name || 'Vendor',
            coupon_count: 0,
            used_count: 0,
          };
        }
        acc[key].coupon_count += 1;
        acc[key].used_count += Number(coupon.used_count || 0);
        return acc;
      }, {});

    res.json({
      success: true,
      coupons: coupons.map(serializeCoupon),
      analytics: {
        summary: {
          totalCoupons: Number(analyticsRows[0]?.total_coupons || 0),
          activeCoupons: Number(analyticsRows[0]?.active_coupons || 0),
          totalRedemptions: Number(analyticsRows[0]?.total_redemptions || 0),
          totalDiscountGiven: Number(impactRows[0]?.total_discount_given || 0),
          averageDiscountValue: Number(impactRows[0]?.avg_discount_value || 0),
          revenueAfterDiscount: Number(impactRows[0]?.revenue_after_discount || 0),
          statusBuckets,
        },
        topCoupons: topCoupons.map((coupon) => ({
          ...coupon,
          used_count: Number(coupon.used_count || 0),
          total_discount: Number(coupon.total_discount || 0),
          net_revenue: Number(coupon.net_revenue || 0),
          avg_discount: Number(coupon.avg_discount || 0),
        })),
        recentRedemptions: recentRedemptions.map((redemption) => redemption.toJSON()),
        vendorBreakdown: Object.values(vendorBreakdown).sort((a, b) => b.used_count - a.used_count || b.coupon_count - a.coupon_count),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create(normalizeCouponPayload(req.body));
    const created = await Coupon.findByPk(coupon.id, {
      include: [{ model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }],
    });
    res.status(201).json({ success: true, message: 'Coupon created', coupon: serializeCoupon(created) });
  } catch (error) {
    next(error);
  }
};

const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

    await coupon.update(normalizeCouponPayload(req.body));
    const updated = await Coupon.findByPk(req.params.id, {
      include: [{ model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }],
    });
    res.json({ success: true, message: 'Coupon updated', coupon: serializeCoupon(updated) });
  } catch (error) {
    next(error);
  }
};

const toggleCouponStatus = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

    await coupon.update({ is_active: !coupon.is_active });
    const updated = await Coupon.findByPk(req.params.id, {
      include: [{ model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }],
    });
    res.json({ success: true, message: `Coupon ${coupon.is_active ? 'activated' : 'deactivated'}`, coupon: serializeCoupon(updated) });
  } catch (error) {
    next(error);
  }
};

module.exports = { validateCouponForCart, getAllCoupons, createCoupon, updateCoupon, toggleCouponStatus };
