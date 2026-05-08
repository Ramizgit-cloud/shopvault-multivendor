const DAY_MS = 24 * 60 * 60 * 1000;
export const STANDARD_SHIPPING_FEE = 79;
export const FREE_SHIPPING_THRESHOLD = 999;

const FAST_PINCODE_PREFIXES = ['110', '122', '201', '400', '411', '500', '560', '600', '700'];
const REMOTE_PINCODE_PREFIXES = ['173', '175', '176', '177', '194', '737', '744', '790', '791', '792', '793', '794', '795', '796', '798', '799'];
const NON_SERVICEABLE_PINCODE_PREFIXES = ['000', '999'];

const addDays = (dateValue, days) => new Date(new Date(dateValue).getTime() + (days * DAY_MS));
const getTrackingEventTimestamp = (event, fallback = null) => event?.timestamp || event?.createdAt || fallback;

const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
});

const formatRange = (start, end) => {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
};

export const extractIndianPincode = (value = '') => {
  const match = String(value).match(/\b\d{6}\b/);
  return match ? match[0] : '';
};

export const getShippingSummary = (subtotal = 0, serviceability = null) => {
  const parsedSubtotal = Number(subtotal) || 0;
  const qualifiesForFreeShipping = parsedSubtotal >= FREE_SHIPPING_THRESHOLD;
  const remainingForFreeShipping = qualifiesForFreeShipping
    ? 0
    : Math.max(FREE_SHIPPING_THRESHOLD - parsedSubtotal, 0);
  const isRemote = serviceability?.tier === 'remote';
  const isServiceable = serviceability?.isServiceable !== false;
  const shippingFee = qualifiesForFreeShipping || !isServiceable
    ? 0
    : STANDARD_SHIPPING_FEE + (isRemote ? 40 : 0);

  return {
    shippingFee,
    qualifiesForFreeShipping,
    remainingForFreeShipping,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    label: qualifiesForFreeShipping
      ? 'Free delivery unlocked'
      : shippingFee > STANDARD_SHIPPING_FEE
        ? `Estimated shipping fee: Rs ${shippingFee}`
        : `Estimated shipping fee: Rs ${shippingFee}`,
    detail: qualifiesForFreeShipping
      ? `This order qualifies for free shipping above Rs ${FREE_SHIPPING_THRESHOLD}.`
      : isRemote
        ? `Remote-area delivery may add a small logistics surcharge. Add Rs ${remainingForFreeShipping} more to unlock free shipping.`
        : `Add Rs ${remainingForFreeShipping} more to unlock free shipping.`,
  };
};

export const getPincodeServiceability = (value = '') => {
  const pincode = extractIndianPincode(value);

  if (!String(value).trim()) {
    return {
      pincode: '',
      isValid: false,
      isServiceable: true,
      tier: 'unknown',
      label: 'Check delivery to your pincode',
      detail: 'Enter a 6-digit pincode to see serviceability and a tighter delivery promise.',
      etaDays: { min: 3, max: 5 },
    };
  }

  if (!pincode) {
    return {
      pincode: '',
      isValid: false,
      isServiceable: false,
      tier: 'invalid',
      label: 'Enter a valid 6-digit pincode',
      detail: 'We use the pincode to confirm whether standard delivery is available in your area.',
      etaDays: null,
    };
  }

  const prefix = pincode.slice(0, 3);
  if (NON_SERVICEABLE_PINCODE_PREFIXES.includes(prefix)) {
    return {
      pincode,
      isValid: true,
      isServiceable: false,
      tier: 'blocked',
      label: `Delivery unavailable for ${pincode}`,
      detail: 'This pincode is outside our current shipping network. Try a nearby address or another delivery location.',
      etaDays: null,
    };
  }

  if (REMOTE_PINCODE_PREFIXES.includes(prefix)) {
    return {
      pincode,
      isValid: true,
      isServiceable: true,
      tier: 'remote',
      label: `Delivery available in ${pincode}`,
      detail: 'We can deliver here, but remote-area logistics may take a little longer than usual.',
      etaDays: { min: 5, max: 8 },
    };
  }

  if (FAST_PINCODE_PREFIXES.includes(prefix)) {
    return {
      pincode,
      isValid: true,
      isServiceable: true,
      tier: 'express',
      label: `Fast delivery available in ${pincode}`,
      detail: 'This pincode is in one of our faster service zones for priority fulfillment.',
      etaDays: { min: 1, max: 3 },
    };
  }

  return {
    pincode,
    isValid: true,
    isServiceable: true,
    tier: 'standard',
    label: `Standard delivery available in ${pincode}`,
    detail: 'This area is serviceable with our regular shipping network.',
    etaDays: { min: 3, max: 5 },
  };
};

export const getOrderDeliveryMessage = (order) => {
  if (!order) return null;

  if (order.status === 'cancelled') {
    return {
      tone: 'alert',
      title: 'This order was cancelled',
      detail: 'Delivery has been stopped. If you paid online, keep an eye on your refund or return updates in the order details.',
    };
  }

  if (order.status === 'delivered') {
    return {
      tone: 'success',
      title: 'Delivered successfully',
      detail: 'Your package reached the delivery address. You can now review the product or start a return if something looks wrong.',
    };
  }

  if (order.status === 'shipped') {
    return {
      tone: 'info',
      title: 'Out for network delivery',
      detail: 'Your seller has handed this order to the courier. The next update should be arrival at the local hub or final delivery.',
    };
  }

  if (order.status === 'processing') {
    return {
      tone: 'warm',
      title: 'Seller is packing your order',
      detail: 'The items are being prepared for dispatch. Shipping details should appear soon once the parcel is handed over.',
    };
  }

  if (order.status === 'confirmed') {
    return {
      tone: 'warm',
      title: 'Order confirmed',
      detail: 'The seller accepted your order and is getting it ready for shipment.',
    };
  }

  return {
    tone: 'warm',
    title: 'Order placed',
    detail: 'We received your order. The seller will confirm stock and start packing shortly.',
  };
};

export const getOrderEstimatedDelivery = (order) => {
  if (!order) return null;
  if (order.status === 'cancelled') {
    return {
      label: 'Cancelled',
      detail: 'This order no longer has a delivery estimate.',
      range: null,
      message: getOrderDeliveryMessage(order),
    };
  }
  if (order.status === 'delivered') {
    const deliveredAt = getTrackingEventTimestamp(
      order.trackingEvents?.find?.((event) => event.status === 'delivered'),
      order.updatedAt || order.createdAt,
    );
    return {
      label: `Delivered on ${formatDate(deliveredAt)}`,
      detail: 'The parcel has already been delivered.',
      range: null,
      message: getOrderDeliveryMessage(order),
    };
  }

  if (order.status === 'shipped') {
    const shippedAt = getTrackingEventTimestamp(
      order.trackingEvents?.find?.((event) => event.status === 'shipped'),
      order.updatedAt || order.createdAt,
    );
    const start = addDays(shippedAt, 1);
    const end = addDays(shippedAt, 3);
    return {
      label: `Expected by ${formatRange(start, end)}`,
      detail: 'The package is already on the way.',
      range: { start, end },
      message: getOrderDeliveryMessage(order),
    };
  }

  const base = order.createdAt || new Date().toISOString();
  const start = addDays(base, order.status === 'processing' ? 2 : 3);
  const end = addDays(base, order.status === 'processing' ? 5 : 6);
  return {
    label: `Estimated delivery ${formatRange(start, end)}`,
    detail: 'Estimated from the order date and current fulfillment stage.',
    range: { start, end },
    message: getOrderDeliveryMessage(order),
  };
};

export const getProductEstimatedDelivery = ({ inStock = false, hasVariants = false, pincode = '', subtotal = 0 } = {}) => {
  const serviceability = getPincodeServiceability(pincode);
  const shipping = getShippingSummary(subtotal, serviceability);

  if (!inStock) {
    return {
      label: 'Unavailable',
      detail: 'Delivery estimate will appear when the item is back in stock.',
      serviceability,
      shipping,
    };
  }

  const pincodeEta = serviceability?.etaDays;
  const variantMinBuffer = hasVariants ? 1 : 0;
  const variantMaxBuffer = hasVariants ? 2 : 0;
  const minDays = (pincodeEta?.min ?? 3) + variantMinBuffer;
  const maxDays = (pincodeEta?.max ?? 5) + variantMaxBuffer;
  const start = addDays(new Date(), minDays);
  const end = addDays(new Date(), maxDays);

  return {
    label: `Get it by ${formatRange(start, end)}`,
    detail: !serviceability?.isValid
      ? 'Add a delivery pincode for a more accurate shipping promise.'
      : hasVariants
        ? 'Variant-based items may need extra packing time.'
        : serviceability?.tier === 'express'
          ? 'Fast-service pincode matched for quicker delivery.'
          : serviceability?.tier === 'remote'
            ? 'Remote-area delivery may take a little longer.'
            : 'Standard estimate for in-stock items.',
    serviceability,
    shipping,
  };
};
