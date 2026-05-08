const {
  Order,
  OrderItem,
  OrderTrackingEvent,
  Product,
  User,
  CouponRedemption,
  VendorCampaign,
  VendorPayout,
  VendorPayoutOrder,
} = require('../models');
const { sequelize } = require('../config/database');
const { validateCoupon } = require('../utils/coupon');
const { evaluateCampaignPricing } = require('../utils/vendorCampaigns');
const { normalizeVariants, serializeVariants, getVariantStockTotal } = require('../utils/productVariants');
const { hasTableColumn, getProductAttributes, getOrderItemAttributes } = require('../utils/schemaSupport');
const { recordRestockEvent, getVendorRestockHistory } = require('../utils/restockHistory');
const { getMessagesForOrder, addMessageToOrder } = require('../utils/orderMessages');
const { buildTrackingEventPayload, normalizeTrackingEvents } = require('../utils/orderTracking');
const { getVendorInventoryAlerts } = require('../utils/inventoryAlerts');
const { sendOrderPlacedEmail, sendOrderStatusEmail, sendRefundApprovedEmail } = require('../utils/commerceEmailFlows');

const CANCEL_REQUEST_OPEN_RE = /\[CANCEL_REQUEST_OPEN:(.+?)\|(.+?)\]/;
const CANCEL_REQUEST_RESOLVED_RE = /\[CANCEL_REQUEST_RESOLVED:(approved|rejected):(.+?)\|(.+?)\]/;
const RETURN_REQUEST_OPEN_RE = /\[RETURN_REQUEST_OPEN:(.+?)\|(.+?)\]/;
const RETURN_REQUEST_RESOLVED_RE = /\[RETURN_REQUEST_RESOLVED:(approved|rejected):(.+?)\|(.+?)\]/;
const stripCancellationMeta = (value = '') => String(value || '')
  .replace(CANCEL_REQUEST_OPEN_RE, '')
  .replace(CANCEL_REQUEST_RESOLVED_RE, '')
  .trim();
const stripReturnMeta = (value = '') => String(value || '')
  .replace(RETURN_REQUEST_OPEN_RE, '')
  .replace(RETURN_REQUEST_RESOLVED_RE, '')
  .trim();
const stripOrderMeta = (value = '') => stripReturnMeta(stripCancellationMeta(value));

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

  return {
    requested: false,
    status: 'none',
    requestedAt: null,
    reason: '',
  };
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

  return {
    requested: false,
    status: 'none',
    requestedAt: null,
    reason: '',
  };
};

const serializeOrderRecord = (record) => {
  const order = record.toJSON ? record.toJSON() : record;
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
    trackingEvents: normalizeTrackingEvents(order.trackingEvents || []),
    campaignSummary,
  };
};

const withOrderCancellationOnItems = (items) => items.map((item) => {
  const record = item.toJSON ? item.toJSON() : item;
  return {
    ...record,
    order: record.order ? serializeOrderRecord(record.order) : record.order,
  };
});

const userCanAccessOrder = (order, user) => {
  if (!order || !user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return Number(order.user_id) === Number(user.id);
  if (user.role === 'vendor') {
    return Array.isArray(order.items) && order.items.some((item) => Number(item.vendor_id) === Number(user.id));
  }
  return false;
};

const getMessageAccessOrder = async (orderId, user) => {
  if (!user) return null;

  if (user.role === 'customer') {
    return Order.findOne({
      where: {
        id: orderId,
        user_id: user.id,
      },
      attributes: ['id', 'user_id'],
    });
  }

  if (user.role === 'admin') {
    return Order.findByPk(orderId, {
      attributes: ['id', 'user_id'],
    });
  }

  if (user.role === 'vendor') {
    return Order.findByPk(orderId, {
      attributes: ['id', 'user_id'],
      include: [{ model: OrderItem, as: 'items', attributes: ['id', 'vendor_id'] }],
    });
  }

  return null;
};

const trackingEventsInclude = {
  model: OrderTrackingEvent,
  as: 'trackingEvents',
  order: [['createdAt', 'ASC']],
};

const formatPayoutReference = (vendorId) => `PO-${vendorId}-${Date.now().toString(36).toUpperCase()}`;

const getVendorPayoutSnapshot = async (vendorId) => {
  const { sequelize: db } = require('../config/database');

  const payouts = await VendorPayout.findAll({
    where: { vendor_id: vendorId },
    include: [{
      model: VendorPayoutOrder,
      as: 'payoutOrders',
      attributes: ['id', 'order_id', 'amount', 'createdAt'],
    }],
    order: [['requested_at', 'DESC']],
  });

  const activeLinkedOrders = new Set();
  payouts.forEach((payout) => {
    if (!['requested', 'scheduled', 'paid'].includes(payout.status)) return;
    payout.payoutOrders.forEach((entry) => activeLinkedOrders.add(Number(entry.order_id)));
  });

  const [eligibleOrderRows] = await db.query(`
    SELECT
      o.id as order_id,
      o.createdAt as order_date,
      o.updatedAt as last_updated,
      o.status,
      o.payment_status,
      ROUND(SUM(oi.price * oi.quantity), 2) as amount,
      SUM(oi.quantity) as items_sold
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.vendor_id = ?
      AND o.payment_status = 'paid'
      AND o.status = 'delivered'
    GROUP BY o.id, o.createdAt, o.updatedAt, o.status, o.payment_status
    ORDER BY o.createdAt DESC
  `, { replacements: [vendorId] });

  const eligibleOrders = eligibleOrderRows.filter((order) => !activeLinkedOrders.has(Number(order.order_id)));

  const payoutRecords = payouts.map((payout) => {
    const record = payout.toJSON ? payout.toJSON() : payout;
    return {
      ...record,
      amount: Number(record.amount || 0),
      order_count: Number(record.order_count || 0),
      payoutOrders: (record.payoutOrders || []).map((entry) => ({
        ...entry,
        amount: Number(entry.amount || 0),
      })),
    };
  });

  const payoutSummary = payoutRecords.reduce((summary, payout) => {
    if (payout.status === 'paid') {
      summary.paid_out += Number(payout.amount || 0);
      summary.settled_payouts += 1;
    } else if (payout.status === 'requested' || payout.status === 'scheduled') {
      summary.pending_payouts += Number(payout.amount || 0);
      summary.pending_requests += 1;
    }
    return summary;
  }, {
    pending_payouts: 0,
    paid_out: 0,
    pending_requests: 0,
    settled_payouts: 0,
  });

  payoutSummary.pending_payouts = Number(payoutSummary.pending_payouts.toFixed(2));
  payoutSummary.paid_out = Number(payoutSummary.paid_out.toFixed(2));

  return {
    payoutRecords,
    eligibleOrders: eligibleOrders.map((order) => ({
      ...order,
      amount: Number(order.amount || 0),
      items_sold: Number(order.items_sold || 0),
    })),
    payoutSummary,
  };
};

// POST /api/orders - Customer
const createOrder = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { items, shipping_address, notes, coupon_code } = req.body;
    const productAttributes = await getProductAttributes();
    const supportsProductVariants = productAttributes.includes('variants');
    const supportsOrderItemVariantId = await hasTableColumn('order_items', 'variant_id');
    const supportsOrderItemVariantLabel = await hasTableColumn('order_items', 'variant_label');

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Order items are required' });
    }

    let total_price = 0;
    const orderItemsData = [];
    const restockEvents = [];
    const campaignProducts = [];

    for (const item of items) {
      const quantity = Number.parseInt(item.quantity, 10);
      if (!Number.isInteger(quantity) || quantity < 1) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Invalid quantity in cart' });
      }

      const product = await Product.findOne({
        attributes: productAttributes,
        where: { id: item.product_id, isActive: true },
        transaction: t,
      });
      if (!product) {
        await t.rollback();
        return res.status(404).json({ success: false, message: `Product ${item.product_id} not found` });
      }
      const variants = supportsProductVariants ? normalizeVariants(product.variants) : [];
      let linePrice = parseFloat(product.price);
      let variantId = null;
      let variantLabel = null;

      if (variants.length > 0) {
        variantId = item.variant_id;
        const selectedVariant = variants.find((variant) => variant.id === variantId);
        if (!selectedVariant) {
          await t.rollback();
          return res.status(400).json({ success: false, message: `Select a valid variant for ${product.name}` });
        }

        if (selectedVariant.stock < quantity) {
          await t.rollback();
          return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name} - ${selectedVariant.label}` });
        }

        const previousVariants = normalizeVariants(product.variants);
        selectedVariant.stock -= quantity;
        variantLabel = selectedVariant.label;
        linePrice = parseFloat(product.price) + parseFloat(selectedVariant.priceAdjustment || 0);

        const productUpdate = { stock: getVariantStockTotal(variants) };
        if (supportsProductVariants) {
          productUpdate.variants = serializeVariants(variants);
        }

        await product.update(productUpdate, { transaction: t });
        restockEvents.push({
          vendorId: product.vendor_id,
          productId: product.id,
          productName: product.name,
          previousStock: previousVariants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0),
          nextStock: productUpdate.stock,
          changeType: 'sale',
          source: 'order',
          previousVariants,
          nextVariants: variants,
        });
      } else {
        if (product.stock < quantity) {
          await t.rollback();
          return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
        }

        await product.update({ stock: product.stock - quantity }, { transaction: t });
        restockEvents.push({
          vendorId: product.vendor_id,
          productId: product.id,
          productName: product.name,
          previousStock: product.stock,
          nextStock: product.stock - quantity,
          changeType: 'sale',
          source: 'order',
          previousVariants: [],
          nextVariants: [],
        });
      }

      const itemTotal = linePrice * quantity;
      total_price += itemTotal;
      campaignProducts.push({
        id: product.id,
        name: product.name,
        price: linePrice,
        vendor_id: product.vendor_id,
        category: product.category,
      });

      const orderItemPayload = {
        product_id: product.id,
        quantity,
        price: linePrice,
        vendor_id: product.vendor_id,
      };

      if (supportsOrderItemVariantId) {
        orderItemPayload.variant_id = variantId;
      }
      if (supportsOrderItemVariantLabel) {
        orderItemPayload.variant_label = variantLabel;
      }

      orderItemsData.push(orderItemPayload);
    }

    const vendorIds = [...new Set(orderItemsData.map((item) => Number(item.vendor_id)).filter(Boolean))];
    const campaigns = vendorIds.length ? await VendorCampaign.findAll({
      where: { vendor_id: vendorIds },
      order: [['createdAt', 'DESC']],
    }) : [];
    const campaignPricing = evaluateCampaignPricing({
      items: orderItemsData,
      products: campaignProducts,
      campaigns,
    });

    let discountResult = null;
    if (coupon_code) {
      discountResult = await validateCoupon({
        code: coupon_code,
        cartTotal: campaignPricing.finalTotal ?? total_price,
        items: orderItemsData,
        userId: req.user.id,
      });
    }

    const order = await Order.create({
      user_id: req.user.id,
      total_price: (discountResult?.finalTotal ?? campaignPricing.finalTotal ?? total_price).toFixed(2),
      campaign_discount_amount: campaignPricing.discountAmount || 0,
      campaign_snapshot: campaignPricing.appliedCampaigns.length ? JSON.stringify(campaignPricing) : null,
      shipping_address,
      notes,
      status: 'pending',
      payment_status: 'unpaid',
    }, { transaction: t });

    await OrderTrackingEvent.create(buildTrackingEventPayload({
      orderId: order.id,
      status: 'pending',
      note: 'Your order has been placed and is awaiting confirmation.',
      actorRole: 'customer',
    }), { transaction: t });

    const itemsWithOrderId = orderItemsData.map((item) => ({ ...item, order_id: order.id }));
    await OrderItem.bulkCreate(itemsWithOrderId, { transaction: t });

    if (discountResult) {
      await CouponRedemption.create({
        coupon_id: discountResult.coupon.id,
        order_id: order.id,
        user_id: req.user.id,
        coupon_code: discountResult.coupon.code,
        vendor_id: discountResult.coupon.vendor_id || null,
        discount_amount: discountResult.discountAmount,
        original_total: (campaignPricing.finalTotal ?? total_price).toFixed(2),
      }, { transaction: t });
    }

    await t.commit();
    await Promise.all(restockEvents.map((event) => recordRestockEvent(event)));

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
        {
          model: OrderItem,
          as: 'items',
          attributes: await getOrderItemAttributes(),
          include: [{ model: Product, as: 'product', attributes: await getProductAttributes() }],
        },
        trackingEventsInclude,
        { model: CouponRedemption, as: 'couponRedemption' },
      ],
    });

    try {
      await sendOrderPlacedEmail({ user: req.user, order: fullOrder });
    } catch (emailError) {
      console.error('Failed to send order placed email:', emailError.message);
    }

    res.status(201).json({ success: true, message: 'Order placed', order: serializeOrderRecord(fullOrder) });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// GET /api/orders/my - Customer
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: OrderItem, as: 'items', attributes: await getOrderItemAttributes(),
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'image', 'price'] }],
        },
        trackingEventsInclude,
        { model: CouponRedemption, as: 'couponRedemption' },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, orders: orders.map(serializeOrderRecord) });
  } catch (error) {
    next(error);
  }
};

// GET /api/orders/:id - Customer (own) / Admin / Vendor (items)
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
        {
          model: OrderItem, as: 'items', attributes: await getOrderItemAttributes(),
          include: [
            { model: Product, as: 'product', attributes: await getProductAttributes() },
            { model: User, as: 'vendorUser', attributes: ['id', 'name'] },
          ],
        },
        trackingEventsInclude,
        { model: CouponRedemption, as: 'couponRedemption' },
      ],
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (!userCanAccessOrder(order, req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, order: serializeOrderRecord(order) });
  } catch (error) {
    next(error);
  }
};

// GET /api/orders/:id/messages
const getOrderMessages = async (req, res, next) => {
  try {
    const order = await getMessageAccessOrder(req.params.id, req.user);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!userCanAccessOrder(order, req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const messages = await getMessagesForOrder(req.params.id);
    res.json({ success: true, messages });
  } catch (error) {
    next(error);
  }
};

// POST /api/orders/:id/messages
const postOrderMessage = async (req, res, next) => {
  try {
    const order = await getMessageAccessOrder(req.params.id, req.user);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!userCanAccessOrder(order, req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const message = await addMessageToOrder({
      orderId: req.params.id,
      user: req.user,
      body: req.body?.body,
    });

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    res.status(201).json({ success: true, message: 'Support message sent', threadMessage: message });
  } catch (error) {
    next(error);
  }
};

// GET /api/orders/vendor/orders - Vendor
const getVendorOrders = async (req, res, next) => {
  try {
    const items = await OrderItem.findAll({
      attributes: await getOrderItemAttributes(),
      where: { vendor_id: req.user.id },
      include: [
        {
          model: Order,
          as: 'order',
          include: [
            { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
            trackingEventsInclude,
          ],
        },
        { model: Product, as: 'product', attributes: ['id', 'name', 'image'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, orderItems: withOrderCancellationOnItems(items) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/orders/:id/request-cancel - Customer
const requestOrderCancellation = async (req, res, next) => {
  try {
    const { reason = '' } = req.body;
    const order = await Order.findByPk(req.params.id);

    if (!order || order.user_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!['pending', 'confirmed', 'processing'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'This order can no longer be cancelled' });
    }

    const cancellation = parseCancellationMeta(order);
    if (cancellation.status === 'pending') {
      return res.status(400).json({ success: false, message: 'Cancellation already requested' });
    }

    const baseNotes = stripOrderMeta(order.notes);
    const requestReason = encodeURIComponent((reason || 'Customer requested cancellation').trim());
    const requestStamp = new Date().toISOString();
    const nextNotes = `${baseNotes} [CANCEL_REQUEST_OPEN:${requestStamp}|${requestReason}]`.trim();

    await order.update({ notes: nextNotes });
    res.json({ success: true, message: 'Cancellation requested', order: serializeOrderRecord(order) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/orders/:id/cancel-decision - Vendor / Admin
const resolveCancellationRequest = async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid cancellation action' });
    }

    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem, as: 'items', attributes: await getOrderItemAttributes() }],
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (req.user.role === 'vendor') {
      const hasVendorItem = order.items.some((item) => item.vendor_id === req.user.id);
      if (!hasVendorItem) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const cancellation = parseCancellationMeta(order);
    if (cancellation.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending cancellation request for this order' });
    }

    const baseNotes = stripOrderMeta(order.notes);
    const resolutionTag = `[CANCEL_REQUEST_RESOLVED:${action === 'approve' ? 'approved' : 'rejected'}:${cancellation.requestedAt}|${encodeURIComponent(cancellation.reason || 'Customer requested cancellation')}]`;

    await order.update({
      status: action === 'approve' ? 'cancelled' : order.status,
      notes: `${baseNotes} ${resolutionTag}`.trim(),
    });

    if (action === 'approve') {
      await OrderTrackingEvent.create(buildTrackingEventPayload({
        orderId: order.id,
        status: 'cancelled',
        note: cancellation.reason || 'The cancellation request was approved.',
        actorRole: req.user.role === 'admin' ? 'admin' : 'vendor',
      }));
    }

    res.json({
      success: true,
      message: action === 'approve' ? 'Cancellation approved' : 'Cancellation rejected',
      order: serializeOrderRecord(order),
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/orders/:id/request-return - Customer
const requestOrderReturn = async (req, res, next) => {
  try {
    const { reason = '' } = req.body;
    const order = await Order.findByPk(req.params.id);

    if (!order || order.user_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
    }

    const returnRequest = parseReturnMeta(order);
    if (returnRequest.status === 'pending') {
      return res.status(400).json({ success: false, message: 'Return request already submitted' });
    }

    const baseNotes = stripOrderMeta(order.notes);
    const requestReason = encodeURIComponent((reason || 'Customer requested a return').trim());
    const requestStamp = new Date().toISOString();
    const nextNotes = `${baseNotes} [RETURN_REQUEST_OPEN:${requestStamp}|${requestReason}]`.trim();

    await order.update({ notes: nextNotes });
    res.json({ success: true, message: 'Return request submitted', order: serializeOrderRecord(order) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/orders/:id/return-decision - Vendor / Admin
const resolveReturnRequest = async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid return action' });
    }

    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem, as: 'items', attributes: await getOrderItemAttributes() }],
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (req.user.role === 'vendor') {
      const hasVendorItem = order.items.some((item) => item.vendor_id === req.user.id);
      if (!hasVendorItem) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const returnRequest = parseReturnMeta(order);
    if (returnRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending return request for this order' });
    }

    const baseNotes = stripOrderMeta(order.notes);
    const resolutionTag = `[RETURN_REQUEST_RESOLVED:${action === 'approve' ? 'approved' : 'rejected'}:${returnRequest.requestedAt}|${encodeURIComponent(returnRequest.reason || 'Customer requested a return')}]`;
    const updatePayload = {
      notes: `${baseNotes} ${resolutionTag}`.trim(),
    };

    if (action === 'approve' && order.payment_status === 'paid') {
      updatePayload.payment_status = 'refunded';
    }

    await order.update(updatePayload);

    if (action === 'approve') {
      try {
        await sendRefundApprovedEmail({ user: order.customer, order });
      } catch (emailError) {
        console.error('Failed to send refund approved email:', emailError.message);
      }
    }

    res.json({
      success: true,
      message: action === 'approve' ? 'Return approved' : 'Return rejected',
      order: serializeOrderRecord(order),
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/orders/:id/status - Vendor / Admin
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note = '' } = req.body;
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    const allowedTransitions = {
      pending: ['pending', 'confirmed', 'cancelled'],
      confirmed: ['confirmed', 'processing', 'cancelled'],
      processing: ['processing', 'shipped', 'cancelled'],
      shipped: ['shipped', 'delivered'],
      delivered: ['delivered'],
      cancelled: ['cancelled'],
    };

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
        { model: OrderItem, as: 'items', attributes: await getOrderItemAttributes() },
        trackingEventsInclude,
      ],
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (req.user.role === 'vendor') {
      const hasVendorItem = order.items.some((item) => Number(item.vendor_id) === Number(req.user.id));
      if (!hasVendorItem) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    if (!allowedTransitions[order.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `You cannot change an order from ${order.status} to ${status}`,
      });
    }

    const trimmedNote = String(note || '').trim();
    const isSameStatus = order.status === status;
    if (isSameStatus && !trimmedNote) {
      return res.status(400).json({ success: false, message: 'This order is already in that status' });
    }

    await order.update({ status });

    await OrderTrackingEvent.create(buildTrackingEventPayload({
      orderId: order.id,
      status,
      note: trimmedNote,
      actorRole: req.user.role === 'admin' ? 'admin' : 'vendor',
    }));

    const refreshedOrder = await Order.findByPk(order.id, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
        { model: OrderItem, as: 'items', attributes: await getOrderItemAttributes() },
        trackingEventsInclude,
      ],
    });

    if (['shipped', 'delivered'].includes(status)) {
      try {
        await sendOrderStatusEmail({
          user: refreshedOrder.customer,
          order: refreshedOrder,
          status,
          note: trimmedNote,
        });
      } catch (emailError) {
        console.error(`Failed to send ${status} email:`, emailError.message);
      }
    }

    res.json({ success: true, message: 'Order status updated', order: serializeOrderRecord(refreshedOrder) });
  } catch (error) {
    next(error);
  }
};

// GET /api/orders/vendor/earnings - Vendor
const getVendorEarnings = async (req, res, next) => {
  try {
    const { sequelize: db } = require('../config/database');
    const [results] = await db.query(`
      SELECT 
        SUM(oi.price * oi.quantity) as total_earnings,
        COUNT(DISTINCT oi.order_id) as total_orders,
        COALESCE(SUM(oi.quantity), 0) as total_items_sold
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.vendor_id = ? AND o.payment_status = 'paid'
    `, { replacements: [req.user.id] });

    const monthly = await db.query(`
      SELECT 
        DATE_FORMAT(o.createdAt, '%Y-%m') as month,
        SUM(oi.price * oi.quantity) as earnings,
        COUNT(DISTINCT oi.order_id) as order_count,
        COALESCE(SUM(oi.quantity), 0) as items_sold
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.vendor_id = ? AND o.payment_status = 'paid'
      GROUP BY DATE_FORMAT(o.createdAt, '%Y-%m')
      ORDER BY month DESC
      LIMIT 6
    `, { replacements: [req.user.id] });

    const bestSellers = await db.query(`
      SELECT
        p.id,
        p.name,
        p.image,
        p.category,
        COUNT(DISTINCT oi.order_id) as order_count,
        COALESCE(SUM(oi.quantity), 0) as units_sold,
        ROUND(COALESCE(SUM(oi.price * oi.quantity), 0), 2) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE oi.vendor_id = ? AND o.payment_status = 'paid'
      GROUP BY p.id, p.name, p.image, p.category
      ORDER BY units_sold DESC, revenue DESC
      LIMIT 5
    `, { replacements: [req.user.id] });

    const [statusBreakdown] = await db.query(`
      SELECT
        o.status,
        COUNT(DISTINCT oi.order_id) as order_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.vendor_id = ?
      GROUP BY o.status
    `, { replacements: [req.user.id] });

    const [trendRows] = await db.query(`
      SELECT
        COUNT(DISTINCT CASE WHEN o.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN oi.order_id END) as orders_last_30,
        COUNT(DISTINCT CASE WHEN o.createdAt < DATE_SUB(NOW(), INTERVAL 30 DAY) AND o.createdAt >= DATE_SUB(NOW(), INTERVAL 60 DAY) THEN oi.order_id END) as orders_prev_30,
        ROUND(COALESCE(SUM(CASE WHEN o.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND o.payment_status = 'paid' THEN oi.price * oi.quantity END), 0), 2) as revenue_last_30,
        ROUND(COALESCE(SUM(CASE WHEN o.createdAt < DATE_SUB(NOW(), INTERVAL 30 DAY) AND o.createdAt >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND o.payment_status = 'paid' THEN oi.price * oi.quantity END), 0), 2) as revenue_prev_30
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.vendor_id = ?
    `, { replacements: [req.user.id] });

    const [awaitingPaymentRows] = await db.query(`
      SELECT
        ROUND(COALESCE(SUM(CASE
          WHEN o.payment_status = 'unpaid'
          THEN oi.price * oi.quantity
        END), 0), 2) as awaiting_payment
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.vendor_id = ?
    `, { replacements: [req.user.id] });

    const payoutSnapshot = await getVendorPayoutSnapshot(req.user.id);
    const settlementHistory = [
      ...payoutSnapshot.payoutRecords.map((record) => ({
        payout_id: record.id,
        reference_code: record.reference_code,
        requested_at: record.requested_at,
        scheduled_for: record.scheduled_for,
        processed_at: record.processed_at,
        amount: Number(record.amount || 0),
        order_count: Number(record.order_count || 0),
        settlement_stage: record.status,
      })),
    ].sort((a, b) => new Date(b.requested_at || b.processed_at || 0) - new Date(a.requested_at || a.processed_at || 0)).slice(0, 8);

    const [conversionRows] = await db.query(`
      SELECT
        COUNT(DISTINCT oi.order_id) as total_orders,
        COUNT(DISTINCT CASE WHEN o.payment_status = 'paid' THEN oi.order_id END) as paid_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN oi.order_id END) as delivered_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN oi.order_id END) as cancelled_orders,
        COUNT(DISTINCT CASE WHEN o.payment_status = 'refunded' THEN oi.order_id END) as refunded_orders
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.vendor_id = ?
    `, { replacements: [req.user.id] });

    const [inventoryRows] = await db.query(`
      SELECT
        COUNT(*) as total_products,
        COUNT(CASE WHEN isActive = 1 THEN 1 END) as active_products,
        COUNT(CASE WHEN isActive = 1 AND stock > 0 AND stock <= 10 THEN 1 END) as low_stock_products,
        COUNT(CASE WHEN isActive = 1 AND stock = 0 THEN 1 END) as out_of_stock_products,
        COALESCE(SUM(CASE WHEN isActive = 1 THEN stock ELSE 0 END), 0) as total_stock_units
      FROM products
      WHERE vendor_id = ?
    `, { replacements: [req.user.id] });
    const vendorProducts = await Product.findAll({
      attributes: ['id', 'name', 'stock', 'category', 'vendor_id', 'isActive'],
      where: { vendor_id: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    const restockHistory = await getVendorRestockHistory(req.user.id, 120);
    const inventoryAlerts = getVendorInventoryAlerts(
      vendorProducts.map((product) => (product.toJSON ? product.toJSON() : product)),
      restockHistory,
    );

    const conversionBase = conversionRows[0] || {};
    const totalOrders = Number(conversionBase.total_orders || 0);
    const paidOrders = Number(conversionBase.paid_orders || 0);
    const deliveredOrders = Number(conversionBase.delivered_orders || 0);
    const cancelledOrders = Number(conversionBase.cancelled_orders || 0);
    const refundedOrders = Number(conversionBase.refunded_orders || 0);

    const conversionStats = {
      total_orders: totalOrders,
      paid_orders: paidOrders,
      delivered_orders: deliveredOrders,
      cancelled_orders: cancelledOrders,
      refunded_orders: refundedOrders,
      payment_conversion_rate: totalOrders ? ((paidOrders / totalOrders) * 100).toFixed(1) : '0.0',
      fulfillment_rate: totalOrders ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : '0.0',
      refund_rate: deliveredOrders ? ((refundedOrders / deliveredOrders) * 100).toFixed(1) : '0.0',
      cancellation_rate: totalOrders ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : '0.0',
    };

    res.json({
      success: true,
      earnings: results[0],
      monthly: monthly[0],
      bestSellers: bestSellers[0],
      payoutSummary: {
        ...payoutSnapshot.payoutSummary,
        awaiting_payment: Number(awaitingPaymentRows[0]?.awaiting_payment || 0),
        eligible_payout_amount: Number(payoutSnapshot.eligibleOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0).toFixed(2)),
        eligible_order_count: payoutSnapshot.eligibleOrders.length,
      },
      settlementHistory,
      payoutRecords: payoutSnapshot.payoutRecords,
      eligiblePayoutOrders: payoutSnapshot.eligibleOrders,
      conversionStats,
      inventoryHealth: inventoryRows[0] || {},
      inventoryAlerts,
      orderTrends: {
        statusBreakdown,
        last30Days: trendRows[0],
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/orders/vendor/payouts - Vendor
const getVendorPayouts = async (req, res, next) => {
  try {
    const snapshot = await getVendorPayoutSnapshot(req.user.id);
    res.json({
      success: true,
      payouts: snapshot.payoutRecords,
      eligibleOrders: snapshot.eligibleOrders,
      summary: {
        ...snapshot.payoutSummary,
        eligible_payout_amount: Number(snapshot.eligibleOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0).toFixed(2)),
        eligible_order_count: snapshot.eligibleOrders.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/orders/vendor/payouts/request - Vendor
const requestVendorPayout = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const requestedOrderIds = Array.isArray(req.body?.order_ids)
      ? req.body.order_ids.map((value) => Number.parseInt(value, 10)).filter(Boolean)
      : [];
    const note = String(req.body?.note || '').trim() || null;

    const snapshot = await getVendorPayoutSnapshot(req.user.id);
    const selectedOrders = requestedOrderIds.length
      ? snapshot.eligibleOrders.filter((order) => requestedOrderIds.includes(Number(order.order_id)))
      : snapshot.eligibleOrders;

    if (!selectedOrders.length) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'No eligible delivered orders available for payout' });
    }

    const amount = Number(selectedOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0).toFixed(2));
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 3);

    const payout = await VendorPayout.create({
      vendor_id: req.user.id,
      reference_code: formatPayoutReference(req.user.id),
      amount,
      status: 'requested',
      order_count: selectedOrders.length,
      requested_at: new Date(),
      scheduled_for: scheduledFor,
      notes: note,
    }, { transaction: t });

    await VendorPayoutOrder.bulkCreate(
      selectedOrders.map((order) => ({
        payout_id: payout.id,
        vendor_id: req.user.id,
        order_id: Number(order.order_id),
        amount: Number(order.amount || 0),
      })),
      { transaction: t },
    );

    await t.commit();

    const created = await VendorPayout.findByPk(payout.id, {
      include: [{ model: VendorPayoutOrder, as: 'payoutOrders', attributes: ['id', 'order_id', 'amount', 'createdAt'] }],
    });

    res.status(201).json({
      success: true,
      message: 'Payout request created',
      payout: {
        ...created.toJSON(),
        amount: Number(created.amount || 0),
      },
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// POST /api/orders/vendor/payouts/:id/demo-mark-paid - Vendor
const markVendorPayoutPaidDemo = async (req, res, next) => {
  try {
    const payout = await VendorPayout.findOne({
      where: {
        id: req.params.id,
        vendor_id: req.user.id,
      },
      include: [{ model: VendorPayoutOrder, as: 'payoutOrders', attributes: ['id', 'order_id', 'amount', 'createdAt'] }],
    });

    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout record not found' });
    }

    if (payout.status === 'paid') {
      return res.status(400).json({ success: false, message: 'This payout is already marked as paid' });
    }

    await payout.update({
      status: 'paid',
      processed_at: new Date(),
    });

    res.json({
      success: true,
      message: 'Payout marked as paid',
      payout: {
        ...payout.toJSON(),
        amount: Number(payout.amount || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/orders (admin all orders)
const getAllOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
        {
          model: OrderItem, as: 'items', attributes: await getOrderItemAttributes(),
          include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
        },
        { model: CouponRedemption, as: 'couponRedemption' },
      ],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      orders: rows.map(serializeOrderRecord),
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  getOrderMessages,
  getVendorOrders,
  requestOrderCancellation,
  resolveCancellationRequest,
  postOrderMessage,
  requestOrderReturn,
  resolveReturnRequest,
  updateOrderStatus,
  getVendorEarnings,
  getVendorPayouts,
  requestVendorPayout,
  markVendorPayoutPaidDemo,
  getAllOrders,
};
