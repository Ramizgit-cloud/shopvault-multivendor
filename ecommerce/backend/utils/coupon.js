const { Coupon, CouponRedemption, Product, User } = require('../models');
const { Op } = require('sequelize');

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getCouponLifecycle = (coupon, now = new Date()) => {
  if (!coupon.is_active) return 'inactive';
  if (coupon.starts_at && now < coupon.starts_at) return 'scheduled';
  if (coupon.expires_at && now > coupon.expires_at) return 'expired';
  if (coupon.usage_limit !== null && coupon.usage_limit <= coupon.used_count) return 'used_up';
  return 'active';
};

const normalizeCouponPayload = (payload = {}) => {
  const normalized = { ...payload };

  if (normalized.code) normalized.code = String(normalized.code).trim().toUpperCase();
  if (normalized.vendor_id === '' || normalized.vendor_id === undefined) normalized.vendor_id = null;
  if (normalized.description !== undefined) normalized.description = String(normalized.description || '').trim() || null;
  if (normalized.usage_limit === '') normalized.usage_limit = null;
  if (normalized.usage_limit_per_user === '') normalized.usage_limit_per_user = null;
  if (normalized.max_discount === '') normalized.max_discount = null;
  if (normalized.starts_at === '') normalized.starts_at = null;
  if (normalized.expires_at === '') normalized.expires_at = null;

  ['discount_value', 'min_order_amount', 'max_discount'].forEach((field) => {
    if (normalized[field] !== undefined && normalized[field] !== null && normalized[field] !== '') {
      normalized[field] = toNumber(normalized[field]);
    }
  });

  ['usage_limit', 'usage_limit_per_user', 'vendor_id'].forEach((field) => {
    if (normalized[field] !== undefined && normalized[field] !== null && normalized[field] !== '') {
      normalized[field] = Number.parseInt(normalized[field], 10);
    }
  });

  return normalized;
};

const buildCouponStatusMeta = (coupon) => {
  const lifecycle = getCouponLifecycle(coupon);
  const remainingUses = coupon.usage_limit === null ? null : Math.max(Number(coupon.usage_limit) - Number(coupon.used_count || 0), 0);

  return {
    lifecycle,
    remainingUses,
    scope: coupon.vendor_id ? 'vendor' : 'platform',
  };
};

const getItemVendorId = (item) => Number(item.vendor_id || item.vendor?.id || item.product?.vendor_id || 0) || null;
const getItemProductId = (item) => Number(item.product_id || item.id || item.product?.id || 0) || null;
const getItemQuantity = (item) => Math.max(Number.parseInt(item.quantity, 10) || 0, 0);
const getItemPrice = (item) => toNumber(item.price, NaN);

const resolveEligibleSubtotal = async ({ coupon, cartTotal, items = [] }) => {
  const baseTotal = toNumber(cartTotal, 0);

  if (!coupon.vendor_id) {
    return {
      eligibleSubtotal: baseTotal,
      scopeLabel: 'Platform-wide coupon',
    };
  }

  const directEligibleSubtotal = Array.isArray(items) ? items.reduce((sum, item) => {
    if (Number(coupon.vendor_id) !== getItemVendorId(item)) return sum;
    const quantity = getItemQuantity(item);
    const price = getItemPrice(item);
    if (!Number.isFinite(price) || quantity <= 0) return sum;
    return sum + (price * quantity);
  }, 0) : 0;

  if (directEligibleSubtotal > 0) {
    return {
      eligibleSubtotal: Number(directEligibleSubtotal.toFixed(2)),
      scopeLabel: `Vendor coupon for ${coupon.vendor?.name || 'selected vendor'}`,
    };
  }

  const productIds = Array.isArray(items)
    ? [...new Set(items.map((item) => getItemProductId(item)).filter(Boolean))]
    : [];

  if (!productIds.length) {
    return {
      eligibleSubtotal: 0,
      scopeLabel: `Vendor coupon for ${coupon.vendor?.name || 'selected vendor'}`,
    };
  }

  const products = await Product.findAll({
    where: { id: { [Op.in]: productIds } },
    attributes: ['id', 'price', 'vendor_id'],
  });
  const productMap = new Map(products.map((product) => [Number(product.id), product]));

  const eligibleSubtotal = items.reduce((sum, item) => {
    const product = productMap.get(getItemProductId(item));
    if (!product || Number(product.vendor_id) !== Number(coupon.vendor_id)) return sum;
    return sum + (toNumber(product.price, 0) * getItemQuantity(item));
  }, 0);

  return {
    eligibleSubtotal: Number(eligibleSubtotal.toFixed(2)),
    scopeLabel: `Vendor coupon for ${coupon.vendor?.name || 'selected vendor'}`,
  };
};

const formatCoupon = (coupon, cartTotal, eligibleSubtotal, scopeLabel) => {
  const baseTotal = toNumber(cartTotal, 0);
  const eligibleAmount = toNumber(eligibleSubtotal, 0);
  let discountAmount = 0;

  if (coupon.discount_type === 'percentage') {
    discountAmount = (eligibleAmount * toNumber(coupon.discount_value, 0)) / 100;
  } else {
    discountAmount = toNumber(coupon.discount_value, 0);
  }

  if (coupon.max_discount) {
    discountAmount = Math.min(discountAmount, toNumber(coupon.max_discount, discountAmount));
  }

  discountAmount = Math.min(discountAmount, eligibleAmount, baseTotal);

  return {
    coupon,
    discountAmount: Number(discountAmount.toFixed(2)),
    finalTotal: Number((baseTotal - discountAmount).toFixed(2)),
    eligibleSubtotal: Number(eligibleAmount.toFixed(2)),
    scopeLabel,
  };
};

const validateCoupon = async ({ code, cartTotal, userId = null, items = [] }) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) {
    const error = new Error('Coupon code is required');
    error.statusCode = 400;
    throw error;
  }

  const coupon = await Coupon.findOne({
    where: { code: normalizedCode },
    include: [{ model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }],
  });

  if (!coupon) {
    const error = new Error('Coupon not found');
    error.statusCode = 404;
    throw error;
  }

  const lifecycle = getCouponLifecycle(coupon);
  if (lifecycle === 'inactive') {
    const error = new Error('Coupon is inactive');
    error.statusCode = 400;
    throw error;
  }
  if (lifecycle === 'scheduled') {
    const error = new Error('Coupon is not active yet');
    error.statusCode = 400;
    throw error;
  }
  if (lifecycle === 'expired') {
    const error = new Error('Coupon has expired');
    error.statusCode = 400;
    throw error;
  }
  if (lifecycle === 'used_up') {
    const error = new Error('Coupon usage limit reached');
    error.statusCode = 400;
    throw error;
  }

  if (coupon.usage_limit_per_user !== null && userId) {
    const userRedemptions = await CouponRedemption.count({
      where: {
        coupon_id: coupon.id,
        user_id: userId,
      },
    });

    if (userRedemptions >= Number(coupon.usage_limit_per_user)) {
      const error = new Error('You have already used this coupon the maximum allowed number of times');
      error.statusCode = 400;
      throw error;
    }
  }

  const { eligibleSubtotal, scopeLabel } = await resolveEligibleSubtotal({ coupon, cartTotal, items });
  if (coupon.vendor_id && eligibleSubtotal <= 0) {
    const error = new Error(`This coupon only applies to items from ${coupon.vendor?.name || 'the selected vendor'}`);
    error.statusCode = 400;
    throw error;
  }

  if (eligibleSubtotal < toNumber(coupon.min_order_amount, 0)) {
    const error = new Error(`Minimum eligible order amount is Rs ${toNumber(coupon.min_order_amount, 0).toFixed(2)}`);
    error.statusCode = 400;
    throw error;
  }

  return formatCoupon(coupon, cartTotal, eligibleSubtotal, scopeLabel);
};

module.exports = {
  validateCoupon,
  formatCoupon,
  getCouponLifecycle,
  buildCouponStatusMeta,
  normalizeCouponPayload,
};
