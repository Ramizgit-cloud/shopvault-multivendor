const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Coupon, CouponRedemption, Order } = require('../models');

const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId === 'your_razorpay_key_id' || keySecret === 'your_razorpay_key_secret' || keyId.startsWith('dummy')) {
    return null;
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

// POST /api/payment/create-order
const createRazorpayOrder = async (req, res, next) => {
  try {
    const razorpay = getRazorpayInstance();
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay is not configured. Update RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.',
      });
    }

    const { order_id } = req.body;

    const order = await Order.findOne({ where: { id: order_id, user_id: req.user.id } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Order already paid' });
    }

    const amount = Math.round(parseFloat(order.total_price) * 100); // paise

    const razorpayOrder = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `receipt_order_${order.id}`,
    });

    await order.update({ razorpay_order_id: razorpayOrder.id });

    res.json({
      success: true,
      razorpayOrder,
      key: process.env.RAZORPAY_KEY_ID,
      order,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/payment/verify
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    const order = await Order.findByPk(order_id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const couponRedemption = await CouponRedemption.findOne({ where: { order_id: order.id } });
    if (couponRedemption && !couponRedemption.is_consumed) {
      const coupon = await Coupon.findByPk(couponRedemption.coupon_id);
      if (coupon) {
        await coupon.update({ used_count: coupon.used_count + 1 });
      }
      await couponRedemption.update({ is_consumed: true });
    }

    await order.update({
      payment_status: 'paid',
      payment_id: razorpay_payment_id,
      razorpay_signature,
      status: 'confirmed',
    });

    res.json({ success: true, message: 'Payment verified successfully', order });
  } catch (error) {
    next(error);
  }
};

// POST /api/payment/demo-complete
const completeDemoPayment = async (req, res, next) => {
  try {
    const { order_id } = req.body;

    const order = await Order.findOne({ where: { id: order_id, user_id: req.user.id } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Order already paid' });
    }

    const couponRedemption = await CouponRedemption.findOne({ where: { order_id: order.id } });
    if (couponRedemption && !couponRedemption.is_consumed) {
      const coupon = await Coupon.findByPk(couponRedemption.coupon_id);
      if (coupon) {
        await coupon.update({ used_count: coupon.used_count + 1 });
      }
      await couponRedemption.update({ is_consumed: true });
    }

    await order.update({
      payment_status: 'paid',
      payment_id: `demo_${Date.now()}`,
      status: 'confirmed',
    });

    res.json({ success: true, message: 'Demo payment completed successfully', order });
  } catch (error) {
    next(error);
  }
};

module.exports = { createRazorpayOrder, verifyPayment, completeDemoPayment };
