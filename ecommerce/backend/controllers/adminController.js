const { User, Product, Order, OrderItem, Review } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const { getProductAttributes, getOrderItemAttributes } = require('../utils/schemaSupport');
const { sendVendorApprovedEmail } = require('../utils/commerceEmailFlows');
const { getAllRestockHistory } = require('../utils/restockHistory');
const { getAdminInventoryAlerts, buildInventoryAlert, LOW_STOCK_THRESHOLD } = require('../utils/inventoryAlerts');

const CANCEL_REQUEST_OPEN_RE = /\[CANCEL_REQUEST_OPEN:(.+?)\|(.+?)\]/;
const CANCEL_REQUEST_RESOLVED_RE = /\[CANCEL_REQUEST_RESOLVED:(approved|rejected):(.+?)\|(.+?)\]/;
const RETURN_REQUEST_OPEN_RE = /\[RETURN_REQUEST_OPEN:(.+?)\|(.+?)\]/;
const RETURN_REQUEST_RESOLVED_RE = /\[RETURN_REQUEST_RESOLVED:(approved|rejected):(.+?)\|(.+?)\]/;
const MANUAL_REVIEW_RE = /\[MANUAL_REVIEW:(flagged|cleared):(.+?)\|(.+?)\]/;
const stripCancellationMeta = (value = '') => String(value || '')
  .replace(CANCEL_REQUEST_OPEN_RE, '')
  .replace(CANCEL_REQUEST_RESOLVED_RE, '')
  .trim();
const stripReturnMeta = (value = '') => String(value || '')
  .replace(RETURN_REQUEST_OPEN_RE, '')
  .replace(RETURN_REQUEST_RESOLVED_RE, '')
  .trim();
const stripManualReviewMeta = (value = '') => String(value || '')
  .replace(MANUAL_REVIEW_RE, '')
  .trim();
const stripOrderMeta = (value = '') => stripManualReviewMeta(stripReturnMeta(stripCancellationMeta(value)));

const parseCancellationMeta = (order) => {
  const notes = order?.notes || '';
  const openMatch = notes.match(CANCEL_REQUEST_OPEN_RE);
  const resolvedMatch = notes.match(CANCEL_REQUEST_RESOLVED_RE);

  if (openMatch) {
    return {
      requested: true,
      status: 'pending',
      requestedAt: openMatch[1],
      reason: decodeURIComponent(openMatch[2]),
    };
  }

  if (resolvedMatch) {
    return {
      requested: resolvedMatch[1] === 'approved',
      status: resolvedMatch[1],
      requestedAt: resolvedMatch[2],
      reason: decodeURIComponent(resolvedMatch[3]),
    };
  }

  return { requested: false, status: 'none', requestedAt: null, reason: '' };
};

const parseReturnMeta = (order) => {
  const notes = order?.notes || '';
  const openMatch = notes.match(RETURN_REQUEST_OPEN_RE);
  const resolvedMatch = notes.match(RETURN_REQUEST_RESOLVED_RE);

  if (openMatch) {
    return {
      requested: true,
      status: 'pending',
      requestedAt: openMatch[1],
      reason: decodeURIComponent(openMatch[2]),
    };
  }

  if (resolvedMatch) {
    return {
      requested: resolvedMatch[1] === 'approved',
      status: resolvedMatch[1],
      requestedAt: resolvedMatch[2],
      reason: decodeURIComponent(resolvedMatch[3]),
    };
  }

  return { requested: false, status: 'none', requestedAt: null, reason: '' };
};

const parseManualReviewMeta = (order) => {
  const notes = order?.notes || '';
  const match = notes.match(MANUAL_REVIEW_RE);

  if (!match) {
    return {
      flagged: false,
      status: 'clear',
      updatedAt: null,
      reason: '',
    };
  }

  return {
    flagged: match[1] === 'flagged',
    status: match[1] === 'flagged' ? 'flagged' : 'clear',
    updatedAt: match[2],
    reason: decodeURIComponent(match[3]),
  };
};

const getStockAlert = (product) => {
  const stock = Number(product?.stock || 0);
  if (stock <= 0) {
    return {
      level: 'critical',
      label: 'Out of stock',
      message: 'This product cannot fulfill new orders.',
    };
  }

  if (stock <= LOW_STOCK_THRESHOLD) {
    return {
      level: 'warning',
      label: 'Low stock',
      message: `${stock} units left. Reorder soon.`,
    };
  }

  return {
    level: 'healthy',
    label: 'Healthy',
    message: `${stock} units available.`,
  };
};

const buildReviewModerationSignals = (review) => {
  const signals = [];
  const comment = String(review.comment || '').trim();
  const reviewerName = review.reviewer?.name || 'Customer';

  if (!review.verifiedPurchase) {
    signals.push({
      code: 'unverified',
      severity: 'warning',
      message: 'Reviewer does not have a delivered purchase for this product.',
    });
  }

  if (!comment) {
    signals.push({
      code: 'empty-comment',
      severity: 'warning',
      message: 'Rating-only review with no written context.',
    });
  } else if (comment.length < 12) {
    signals.push({
      code: 'short-comment',
      severity: 'warning',
      message: 'Very short review that may need a quick authenticity check.',
    });
  }

  if (review.rating === 1 || review.rating === 5) {
    signals.push({
      code: 'extreme-rating',
      severity: 'info',
      message: 'Extreme rating that may deserve a quick moderation glance.',
    });
  }

  if (comment && reviewerName && comment.toLowerCase().includes(reviewerName.toLowerCase())) {
    signals.push({
      code: 'self-reference',
      severity: 'info',
      message: 'Review text contains the reviewer name.',
    });
  }

  return signals;
};

const serializeReviewRecord = (review, verifiedReviewerIds = new Set()) => {
  const record = review.toJSON ? review.toJSON() : review;
  const verifiedPurchase = verifiedReviewerIds.has(Number(record.user_id));

  return {
    ...record,
    verifiedPurchase,
    moderationSignals: buildReviewModerationSignals({ ...record, verifiedPurchase }),
  };
};

const buildSuspiciousOrderSignals = (orders) => {
  const userBuckets = new Map();
  const addressBuckets = new Map();

  orders.forEach((record) => {
    const order = record.toJSON ? record.toJSON() : record;
    const userId = Number(order.user_id || order.customer?.id || 0);
    if (!userBuckets.has(userId)) userBuckets.set(userId, []);
    userBuckets.get(userId).push(order);

    const addressKey = String(order.shipping_address || '').trim().toLowerCase();
    if (addressKey) {
      if (!addressBuckets.has(addressKey)) addressBuckets.set(addressKey, []);
      addressBuckets.get(addressKey).push(order);
    }
  });

  const suspiciousByOrderId = new Map();
  const suspiciousByUserId = new Map();

  userBuckets.forEach((userOrders, userId) => {
    const sorted = [...userOrders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const userSignals = [];

    sorted.forEach((order, index) => {
      const currentTime = new Date(order.createdAt).getTime();
      const recentOrders = sorted.filter((candidate) => {
        const candidateTime = new Date(candidate.createdAt).getTime();
        return Math.abs(currentTime - candidateTime) <= 24 * 60 * 60 * 1000;
      });

      const sameAddressOrders = addressBuckets.get(String(order.shipping_address || '').trim().toLowerCase()) || [];
      const signals = [];

      if (recentOrders.length >= 3) {
        signals.push({
          code: 'repeat-window',
          label: 'Repeated orders',
          severity: recentOrders.length >= 5 ? 'critical' : 'warning',
          message: `${recentOrders.length} orders were placed by this customer within 24 hours.`,
        });
      }

      if (sameAddressOrders.length >= 3) {
        signals.push({
          code: 'shared-address',
          label: 'Address spike',
          severity: sameAddressOrders.length >= 5 ? 'critical' : 'warning',
          message: `${sameAddressOrders.length} orders share the same delivery address.`,
        });
      }

      if (order.payment_status === 'unpaid' && recentOrders.length >= 2) {
        signals.push({
          code: 'unpaid-repeat',
          label: 'Repeated unpaid attempts',
          severity: 'warning',
          message: 'Multiple recent orders were placed without completing payment.',
        });
      }

      if (signals.length) {
        suspiciousByOrderId.set(order.id, signals);
        userSignals.push(...signals);
      }

      if (index === sorted.length - 1 && userSignals.length) {
        const uniqueSignals = Array.from(new Map(userSignals.map((signal) => [signal.code, signal])).values());
        suspiciousByUserId.set(userId, uniqueSignals);
      }
    });
  });

  return { suspiciousByOrderId, suspiciousByUserId };
};

const serializeOrderRecord = (record, suspiciousByOrderId = new Map()) => {
  const order = record.toJSON ? record.toJSON() : record;
  const manualReview = parseManualReviewMeta(order);
  const suspiciousSignals = suspiciousByOrderId.get(order.id) || [];
  let campaignSummary = null;

  if (order.campaign_snapshot) {
    try {
      campaignSummary = typeof order.campaign_snapshot === 'string'
        ? JSON.parse(order.campaign_snapshot)
        : order.campaign_snapshot;
    } catch (_error) {
      campaignSummary = null;
    }
  }

  return {
    ...order,
    notes: stripOrderMeta(order.notes),
    cancellation: parseCancellationMeta(order),
    returnRequest: parseReturnMeta(order),
    manualReview,
    suspiciousSignals,
    campaignSummary,
  };
};

// GET /api/admin/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const [totalUsers] = await sequelize.query(`SELECT COUNT(*) as count FROM users WHERE role = 'customer'`);
    const [totalVendors] = await sequelize.query(`SELECT COUNT(*) as count FROM users WHERE role = 'vendor'`);
    const [totalProducts] = await sequelize.query(`SELECT COUNT(*) as count FROM products WHERE isActive = 1`);
    const [totalOrders] = await sequelize.query(`SELECT COUNT(*) as count FROM orders`);
    const [totalRevenue] = await sequelize.query(`SELECT COALESCE(SUM(total_price), 0) as total FROM orders WHERE payment_status = 'paid'`);
    const [recentOrders] = await sequelize.query(`
      SELECT o.id, o.total_price, o.status, o.payment_status, o.createdAt, u.name as customer_name
      FROM orders o JOIN users u ON o.user_id = u.id
      ORDER BY o.createdAt DESC LIMIT 5
    `);
    const [monthlySales] = await sequelize.query(`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, SUM(total_price) as revenue, COUNT(*) as orders
      FROM orders WHERE payment_status = 'paid'
      GROUP BY month ORDER BY month DESC LIMIT 6
    `);
    const [dailySales] = await sequelize.query(`
      SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') as day, SUM(total_price) as revenue, COUNT(*) as orders
      FROM orders
      WHERE payment_status = 'paid'
        AND YEAR(createdAt) = YEAR(CURDATE())
        AND MONTH(createdAt) = MONTH(CURDATE())
      GROUP BY day
      ORDER BY day ASC
    `);
    const [yearlySales] = await sequelize.query(`
      SELECT YEAR(createdAt) as year, SUM(total_price) as revenue, COUNT(*) as orders
      FROM orders
      WHERE payment_status = 'paid'
      GROUP BY YEAR(createdAt)
      ORDER BY year DESC
      LIMIT 5
    `);
    const [riskSnapshot] = await sequelize.query(`
      SELECT
        COUNT(CASE WHEN isActive = 0 THEN 1 END) as blocked_users,
        COUNT(CASE WHEN role = 'vendor' AND isApproved = 0 THEN 1 END) as pending_vendor_reviews
      FROM users
    `);
    const [stockSnapshot] = await sequelize.query(`
      SELECT
        COUNT(CASE WHEN isActive = 1 AND stock = 0 THEN 1 END) as out_of_stock_products,
        COUNT(CASE WHEN isActive = 1 AND stock > 0 AND stock <= ? THEN 1 END) as low_stock_products
      FROM products
    `, { replacements: [LOW_STOCK_THRESHOLD] });
    const orders = await Order.findAll({
      attributes: ['id', 'user_id', 'payment_status', 'shipping_address', 'createdAt', 'notes'],
      include: [{ model: User, as: 'customer', attributes: ['id'] }],
      order: [['createdAt', 'DESC']],
    });
    const productsForAlerts = await Product.findAll({
      attributes: ['id', 'name', 'stock', 'category', 'vendor_id', 'isActive'],
      where: { isActive: true },
      include: [{ model: User, as: 'vendor', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    const restockHistory = await getAllRestockHistory(300);
    const { suspiciousByOrderId } = buildSuspiciousOrderSignals(orders);
    const manualReviewCount = orders.filter((order) => parseManualReviewMeta(order).flagged).length;
    const inventoryAlerts = getAdminInventoryAlerts(
      productsForAlerts.map((product) => (product.toJSON ? product.toJSON() : product)),
      restockHistory,
    );

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers[0].count,
        totalVendors: totalVendors[0].count,
        totalProducts: totalProducts[0].count,
        totalOrders: totalOrders[0].count,
        totalRevenue: totalRevenue[0].total,
      },
      recentOrders,
      monthlySales,
      dailySales,
      yearlySales,
      controls: {
        blockedUsers: Number(riskSnapshot[0]?.blocked_users || 0),
        pendingVendorReviews: Number(riskSnapshot[0]?.pending_vendor_reviews || 0),
        lowStockProducts: Number(stockSnapshot[0]?.low_stock_products || 0),
        outOfStockProducts: Number(stockSnapshot[0]?.out_of_stock_products || 0),
        suspiciousOrders: suspiciousByOrderId.size,
        manualReviewOrders: manualReviewCount,
      },
      inventoryAlerts,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/users
const getAllUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const where = {};
    if (role) where.role = role;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    const userIds = rows.map((user) => user.id);
    const orderRows = userIds.length ? await Order.findAll({
      attributes: ['id', 'user_id', 'status', 'payment_status', 'shipping_address', 'createdAt', 'notes'],
      where: { user_id: userIds },
      order: [['createdAt', 'DESC']],
    }) : [];
    const { suspiciousByUserId } = buildSuspiciousOrderSignals(orderRows);
    const orderStatsByUserId = orderRows.reduce((acc, order) => {
      const userId = Number(order.user_id);
      if (!acc[userId]) {
        acc[userId] = {
          totalOrders: 0,
          cancelledOrders: 0,
          refundedOrders: 0,
        };
      }
      acc[userId].totalOrders += 1;
      if (order.status === 'cancelled') acc[userId].cancelledOrders += 1;
      if (order.payment_status === 'refunded') acc[userId].refundedOrders += 1;
      return acc;
    }, {});

    const users = rows.map((user) => {
      const record = serializeUserRecord(user);
      const stats = orderStatsByUserId[record.id] || { totalOrders: 0, cancelledOrders: 0, refundedOrders: 0 };
      return {
        ...record,
        orderStats: stats,
        riskSignals: suspiciousByUserId.get(Number(record.id)) || [],
      };
    });

    res.json({ success: true, users, total: count });
  } catch (error) {
    next(error);
  }
};

const serializeUserRecord = (user) => user.toJSON ? user.toJSON() : user;

const setUserBlockedState = async (req, res, next, forcedState = null) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot modify admin' });

    const nextActiveState = forcedState === null ? !user.isActive : !forcedState;
    await user.update({ isActive: nextActiveState });
    res.json({
      success: true,
      message: `User ${nextActiveState ? 'activated' : 'blocked'}`,
      user: serializeUserRecord(user),
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/users/:id/toggle-status
const toggleUserStatus = async (req, res, next) => setUserBlockedState(req, res, next);

// PUT /api/admin/user/block/:id
const blockUserAdmin = async (req, res, next) => setUserBlockedState(req, res, next, true);

// DELETE /api/admin/user/:id
const deleteUserAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete admin' });

    await user.destroy();
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/vendors/:id/approve
const approveVendor = async (req, res, next) => {
  try {
    const vendor = await User.findOne({ where: { id: req.params.id, role: 'vendor' } });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    if (vendor.isApproved) return res.status(400).json({ success: false, message: 'Vendor is already approved' });

    await vendor.update({ isApproved: true });
    try {
      await sendVendorApprovedEmail({ vendor });
    } catch (emailError) {
      console.error('Failed to send vendor approved email:', emailError.message);
    }
    res.json({ success: true, message: 'Vendor approved', vendor: vendor.toJSON() });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/vendors
const getAllVendors = async (req, res, next) => {
  try {
    const vendors = await User.findAll({
      where: { role: 'vendor' },
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, vendors });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/vendor/approve/:id
const approveVendorAlias = async (req, res, next) => approveVendor(req, res, next);

// PUT /api/admin/vendor/block/:id
const blockVendor = async (req, res, next) => setUserBlockedState(req, res, next, true);

// GET /api/admin/products
const getAllProductsAdmin = async (req, res, next) => {
  try {
    const restockHistory = await getAllRestockHistory(300);
    const historyByProductId = restockHistory.reduce((acc, entry) => {
      const productId = Number(entry.product_id);
      if (!productId) return acc;
      if (!acc[productId]) acc[productId] = [];
      acc[productId].push(entry);
      return acc;
    }, {});
    const products = await Product.findAll({
      attributes: await getProductAttributes(),
      include: [{ model: User, as: 'vendor', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({
      success: true,
      products: products.map((product) => {
        const record = product.toJSON ? product.toJSON() : product;
        return {
          ...record,
          stockAlert: getStockAlert(record),
          inventoryInsight: buildInventoryAlert(record, historyByProductId[Number(record.id)] || []),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/products/:id
const deleteProductAdmin = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      attributes: await getProductAttributes(),
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    await product.update({ isActive: false });
    res.json({ success: true, message: 'Product removed' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/product/:id
const deleteProductAdminAlias = async (req, res, next) => deleteProductAdmin(req, res, next);

// GET /api/admin/orders
const getAllOrdersAdmin = async (req, res, next) => {
  try {
    const orders = await Order.findAll({
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
        {
          model: OrderItem,
          as: 'items',
          attributes: await getOrderItemAttributes(),
          include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    const { suspiciousByOrderId } = buildSuspiciousOrderSignals(orders);

    res.json({ success: true, orders: orders.map((order) => serializeOrderRecord(order, suspiciousByOrderId)) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/orders/:id/review-flag
const setOrderReviewFlag = async (req, res, next) => {
  try {
    const { flagged, reason = '' } = req.body;
    if (typeof flagged !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Flagged must be true or false' });
    }

    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
        {
          model: OrderItem,
          as: 'items',
          attributes: await getOrderItemAttributes(),
          include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const baseNotes = stripOrderMeta(order.notes);
    const nextReason = encodeURIComponent(String(reason || (flagged ? 'Admin requested manual review' : 'Manual review cleared')).trim());
    const nextTag = `[MANUAL_REVIEW:${flagged ? 'flagged' : 'cleared'}:${new Date().toISOString()}|${nextReason}]`;
    await order.update({ notes: `${baseNotes} ${nextTag}`.trim() });

    const suspiciousByOrderId = new Map();
    suspiciousByOrderId.set(order.id, buildSuspiciousOrderSignals([order]).suspiciousByOrderId.get(order.id) || []);

    res.json({
      success: true,
      message: flagged ? 'Order flagged for manual review' : 'Manual review cleared',
      order: serializeOrderRecord(order, suspiciousByOrderId),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/payments
const getAllPaymentsAdmin = async (req, res, next) => {
  try {
    const payments = await Order.findAll({
      attributes: ['id', 'total_price', 'payment_status', 'payment_id', 'razorpay_order_id', 'createdAt', 'updatedAt'],
      include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
    });

    const result = payments.map((order) => {
      const record = order.toJSON();
      return {
        id: record.id,
        order_id: record.id,
        amount: record.total_price,
        status: record.payment_status,
        payment_id: record.payment_id || record.razorpay_order_id || 'N/A',
        method: record.payment_id || record.razorpay_order_id ? 'online' : record.payment_status === 'unpaid' ? 'pending' : 'manual',
        customer: record.customer,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
    });

    res.json({ success: true, payments: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/reviews
const getAllReviewsAdmin = async (req, res, next) => {
  try {
    const reviews = await Review.findAll({
      include: [
        { model: User, as: 'reviewer', attributes: ['id', 'name', 'email'] },
        { model: Product, as: 'product', attributes: ['id', 'name', 'image', 'category'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const productIds = [...new Set(reviews.map((review) => Number(review.product_id)).filter(Boolean))];
    const deliveredItems = productIds.length ? await OrderItem.findAll({
      where: { product_id: { [Op.in]: productIds } },
      include: [{
        model: Order,
        as: 'order',
        where: { status: 'delivered' },
        attributes: ['user_id'],
      }],
      attributes: ['product_id'],
    }) : [];

    const verifiedReviewerIds = new Set(
      deliveredItems.map((item) => Number(item.order?.user_id)).filter(Boolean),
    );

    res.json({
      success: true,
      reviews: reviews.map((review) => serializeReviewRecord(review, verifiedReviewerIds)),
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/reviews/:id
const deleteReviewAdmin = async (req, res, next) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    await review.destroy();
    res.json({ success: true, message: 'Review removed' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getAllUsers,
  toggleUserStatus,
  blockUserAdmin,
  deleteUserAdmin,
  approveVendor,
  approveVendorAlias,
  getAllVendors,
  blockVendor,
  getAllProductsAdmin,
  deleteProductAdmin,
  deleteProductAdminAlias,
  getAllOrdersAdmin,
  setOrderReviewFlag,
  getAllPaymentsAdmin,
  getAllReviewsAdmin,
  deleteReviewAdmin,
};
