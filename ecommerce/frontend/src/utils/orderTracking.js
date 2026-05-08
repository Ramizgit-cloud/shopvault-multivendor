const statusMeta = {
  pending: {
    label: 'Order placed',
    note: 'We received your order and are waiting for seller confirmation.',
  },
  confirmed: {
    label: 'Confirmed',
    note: 'The seller confirmed your order.',
  },
  processing: {
    label: 'Preparing shipment',
    note: 'Your items are being packed for dispatch.',
  },
  shipped: {
    label: 'Shipped',
    note: 'Your package is on the way.',
  },
  delivered: {
    label: 'Delivered',
    note: 'Your order was marked as delivered.',
  },
  cancelled: {
    label: 'Cancelled',
    note: 'This order was cancelled before delivery.',
  },
};

const orderedStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

const getEventTimestamp = (event, order) => event?.timestamp || event?.createdAt || order?.updatedAt || order?.createdAt || null;

const normalizeTrackingEvents = (order) => {
  const storedEvents = Array.isArray(order?.trackingEvents) ? [...order.trackingEvents] : [];

  if (storedEvents.length > 0) {
    return storedEvents
      .sort((a, b) => new Date(getEventTimestamp(a, order) || 0) - new Date(getEventTimestamp(b, order) || 0))
      .map((event) => ({
        key: `${event.id || event.status}-${getEventTimestamp(event, order) || 'pending'}`,
        status: event.status,
        title: event.title || statusMeta[event.status]?.label || 'Tracking update',
        description: event.description || statusMeta[event.status]?.note || '',
        timestamp: getEventTimestamp(event, order),
        actorRole: event.actorRole || event.actor_role || 'system',
      }));
  }

  return [{
    key: `fallback-${order?.id || 'order'}`,
    status: order?.status || 'pending',
    title: statusMeta[order?.status]?.label || 'Order update',
    description: statusMeta[order?.status]?.note || 'Order activity will appear here once the seller updates it.',
    timestamp: order?.updatedAt || order?.createdAt,
    actorRole: 'system',
  }];
};

const buildProgressSteps = (order) => {
  if (order?.status === 'cancelled') {
    const events = normalizeTrackingEvents(order);
    const cancelledEvent = [...events].reverse().find((event) => event.status === 'cancelled');
    return [
      {
        key: 'pending',
        status: 'pending',
        title: statusMeta.pending.label,
        description: statusMeta.pending.note,
        state: 'done',
        timestamp: order?.createdAt,
      },
      {
        key: 'cancelled',
        status: 'cancelled',
        title: statusMeta.cancelled.label,
        description: cancelledEvent?.description || statusMeta.cancelled.note,
        state: 'current',
        timestamp: cancelledEvent?.timestamp || order?.updatedAt || order?.createdAt,
      },
    ];
  }

  const events = normalizeTrackingEvents(order);
  const indexByStatus = orderedStatuses.reduce((map, status, index) => {
    map[status] = index;
    return map;
  }, {});
  const currentIndex = indexByStatus[order?.status] ?? 0;
  const latestEventByStatus = events.reduce((map, event) => {
    map[event.status] = event;
    return map;
  }, {});

  return orderedStatuses.map((status, index) => {
    let state = 'upcoming';
    if (index < currentIndex) state = 'done';
    if (index === currentIndex) state = 'current';

    const event = latestEventByStatus[status];
    return {
      key: status,
      status,
      title: statusMeta[status].label,
      description: event?.description || statusMeta[status].note,
      timestamp: event?.timestamp || (status === 'pending' ? order?.createdAt : null),
      state,
    };
  });
};

export const getTrackingFeed = (order) => normalizeTrackingEvents(order);
export const getTrackingProgress = (order) => buildProgressSteps(order);
