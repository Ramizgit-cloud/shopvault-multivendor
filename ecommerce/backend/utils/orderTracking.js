const ORDER_TRACKING_META = {
  pending: {
    title: 'Order placed',
    defaultDescription: 'We received the order and are waiting for the seller to confirm it.',
  },
  confirmed: {
    title: 'Order confirmed',
    defaultDescription: 'The seller confirmed the order and will start preparing it.',
  },
  processing: {
    title: 'Preparing shipment',
    defaultDescription: 'Items are being packed and prepared for dispatch.',
  },
  shipped: {
    title: 'Shipped',
    defaultDescription: 'The package has left the seller and is on the way.',
  },
  delivered: {
    title: 'Delivered',
    defaultDescription: 'The order was marked as delivered to the customer.',
  },
  cancelled: {
    title: 'Cancelled',
    defaultDescription: 'The order was cancelled before delivery.',
  },
};

const getTrackingMeta = (status) => ORDER_TRACKING_META[status] || {
  title: 'Tracking update',
  defaultDescription: 'The order timeline was updated.',
};

const buildTrackingEventPayload = ({ orderId, status, note = '', actorRole = 'system' }) => {
  const meta = getTrackingMeta(status);
  return {
    order_id: orderId,
    status,
    title: meta.title,
    description: String(note || '').trim() || meta.defaultDescription,
    actor_role: actorRole,
  };
};

const normalizeTrackingEvents = (events = []) => events
  .map((event) => (event.toJSON ? event.toJSON() : event))
  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

module.exports = {
  ORDER_TRACKING_META,
  getTrackingMeta,
  buildTrackingEventPayload,
  normalizeTrackingEvents,
};
