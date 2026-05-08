import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import OrderTrackingTimeline from './OrderTrackingTimeline';
import { orderAPI } from '../services/api';
import { downloadInvoicePdf } from '../utils/invoicePdf';

const formatDateTime = (value) => {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDate = (value) => {
  if (!value) return 'Not available';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatMoney = (value) => `Rs ${Number.parseFloat(value || 0).toFixed(2)}`;

const getPaymentMethodLabel = (order) => {
  if (String(order.payment_id || '').startsWith('demo_')) return 'Demo checkout';
  if (order.payment_id || order.razorpay_order_id) return 'Razorpay';
  return 'Cash on Delivery';
};

const getPaymentEvents = (order) => {
  const events = [
    {
      key: `invoice-${order.id}`,
      title: 'Invoice created',
      description: `Invoice is available for order #${order.id}.`,
      timestamp: order.createdAt,
      tone: 'info',
    },
    {
      key: `order-${order.id}`,
      title: 'Order recorded',
      description: `Order total ${formatMoney(order.total_price)} was recorded for ${getPaymentMethodLabel(order)}.`,
      timestamp: order.createdAt,
      tone: 'info',
    },
  ];

  if (order.razorpay_order_id) {
    events.push({
      key: `gateway-${order.id}`,
      title: 'Payment attempt started',
      description: 'A Razorpay payment order was created and checkout was initiated.',
      timestamp: order.updatedAt || order.createdAt,
      tone: 'warning',
    });
  }

  if (order.payment_id) {
    events.push({
      key: `payment-${order.id}`,
      title: 'Payment captured',
      description: `Payment reference ${order.payment_id} was recorded successfully.`,
      timestamp: order.updatedAt || order.createdAt,
      tone: 'success',
    });
  } else if (order.payment_status === 'unpaid') {
    events.push({
      key: `payment-pending-${order.id}`,
      title: order.razorpay_order_id ? 'Payment pending' : 'Collection pending',
      description: order.razorpay_order_id
        ? 'The online checkout was started but payment has not been verified yet.'
        : 'This order is waiting for cash collection or offline settlement.',
      timestamp: order.updatedAt || order.createdAt,
      tone: 'warning',
    });
  }

  if (order.returnRequest?.status === 'pending') {
    events.push({
      key: `refund-request-${order.id}`,
      title: 'Refund review in progress',
      description: order.returnRequest.reason || 'Your return request is being reviewed.',
      timestamp: order.returnRequest.requestedAt || order.updatedAt || order.createdAt,
      tone: 'warning',
    });
  }

  if (order.returnRequest?.status === 'approved' || order.payment_status === 'refunded') {
    events.push({
      key: `refund-approved-${order.id}`,
      title: order.payment_status === 'refunded' ? 'Refund processed' : 'Refund approved',
      description: order.payment_status === 'refunded'
        ? 'The order payment has been marked as refunded.'
        : 'The return was approved and refund processing is underway.',
      timestamp: order.updatedAt || order.createdAt,
      tone: order.payment_status === 'refunded' ? 'success' : 'info',
    });
  }

  return events.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
};

const PurchaseHistoryCard = ({ order, user, expanded, onToggle }) => {
  const paymentEvents = getPaymentEvents(order);
  const deliveryUpdates = Array.isArray(order.trackingEvents) ? order.trackingEvents.length : 0;

  return (
    <div className="purchase-history-card">
      <div className="purchase-history-header">
        <div>
          <div className="purchase-history-title-row">
            <strong>Order #{order.id}</strong>
            <span className={`badge badge-${order.status}`}>{order.status}</span>
            <span className={`badge badge-${order.payment_status}`}>{order.payment_status}</span>
          </div>
          <p className="purchase-history-meta">
            Placed {formatDate(order.createdAt)} . {formatMoney(order.total_price)} . {getPaymentMethodLabel(order)}
          </p>
        </div>

        <div className="purchase-history-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              try {
                downloadInvoicePdf(order, user);
                toast.success(`GST bill downloaded for order #${order.id}`);
              } catch {
                toast.error('Failed to generate GST bill');
              }
            }}
          >
            Download GST Bill
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onToggle}>
            {expanded ? 'Hide Details' : 'View Details'}
          </button>
        </div>
      </div>

      <div className="purchase-history-topline">
        <div className="purchase-mini-stat">
          <span>Payment events</span>
          <strong>{paymentEvents.length}</strong>
        </div>
        <div className="purchase-mini-stat">
          <span>Delivery updates</span>
          <strong>{deliveryUpdates}</strong>
        </div>
        <div className="purchase-mini-stat">
          <span>Refund status</span>
          <strong>
            {order.payment_status === 'refunded'
              ? 'Refunded'
              : order.returnRequest?.status === 'pending'
                ? 'In review'
                : order.returnRequest?.status === 'approved'
                  ? 'Approved'
                  : 'None'}
          </strong>
        </div>
      </div>

      {expanded && (
        <div className="purchase-history-body">
          <div className="purchase-history-panels">
            <section className="purchase-panel">
              <div className="purchase-panel-header">
                <h3>Invoice</h3>
                <span>Order summary and billing record</span>
              </div>
              <div className="purchase-panel-card">
                <div className="purchase-panel-row">
                  <span>GST Bill</span>
                  <strong>shopvault-gst-bill-order-{order.id}.pdf</strong>
                </div>
                <div className="purchase-panel-row">
                  <span>Issued</span>
                  <strong>{formatDateTime(order.createdAt)}</strong>
                </div>
                <div className="purchase-panel-row">
                  <span>Amount</span>
                  <strong>{formatMoney(order.total_price)}</strong>
                </div>
                <div className="purchase-panel-row">
                  <span>Billing name</span>
                  <strong>{user?.billingName || user?.name || 'Customer'}</strong>
                </div>
                <div className="purchase-panel-row">
                  <span>GSTIN</span>
                  <strong>{user?.gstin || 'Not provided'}</strong>
                </div>
                <div className="purchase-panel-row">
                  <span>Coupon</span>
                  <strong>{order.couponRedemption?.coupon_code || 'None'}</strong>
                </div>
                <div className="purchase-panel-row">
                  <span>Shipping address</span>
                  <strong>{order.shipping_address || 'Not provided'}</strong>
                </div>
              </div>
            </section>

            <section className="purchase-panel">
              <div className="purchase-panel-header">
                <h3>Payment History</h3>
                <span>Attempts, captures, and refund activity</span>
              </div>
              <div className="purchase-event-list">
                {paymentEvents.map((event) => (
                  <div key={event.key} className={`purchase-event-item ${event.tone}`}>
                    <div className="purchase-event-top">
                      <strong>{event.title}</strong>
                      <span>{formatDateTime(event.timestamp)}</span>
                    </div>
                    <p>{event.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {(order.returnRequest?.status !== 'none' || order.cancellation?.status !== 'none') && (
            <section className="purchase-panel purchase-panel-full">
              <div className="purchase-panel-header">
                <h3>Refunds And Requests</h3>
                <span>Cancellations, returns, and refund review status</span>
              </div>
              <div className="purchase-request-grid">
                <div className="purchase-request-card">
                  <span>Cancellation</span>
                  <strong>{order.cancellation?.status || 'none'}</strong>
                  <p>{order.cancellation?.reason || 'No cancellation request on this order.'}</p>
                </div>
                <div className="purchase-request-card">
                  <span>Return</span>
                  <strong>{order.returnRequest?.status || 'none'}</strong>
                  <p>{order.returnRequest?.reason || 'No return request on this order.'}</p>
                </div>
              </div>
            </section>
          )}

          <section className="purchase-panel purchase-panel-full">
            <div className="purchase-panel-header">
              <h3>Delivery Updates</h3>
              <span>Live shipment and fulfillment timeline</span>
            </div>
            <OrderTrackingTimeline order={order} compact />
          </section>
        </div>
      )}
    </div>
  );
};

const ProfilePurchaseHistory = ({ user }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    orderAPI.getMyOrders()
      .then((response) => {
        if (!active) return;
        setOrders(response.data.orders || []);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error.response?.data?.message || 'Failed to load purchase history');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const historySummary = useMemo(() => ({
    invoices: orders.length,
    pendingPayments: orders.filter((order) => order.payment_status === 'unpaid' && order.status !== 'cancelled').length,
    refunds: orders.filter((order) => order.payment_status === 'refunded').length,
    deliveries: orders.filter((order) => ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status)).length,
  }), [orders]);

  return (
    <section className="profile-section card profile-history-section">
      <div className="profile-history-header">
        <div>
          <h2>Payment And Invoice History</h2>
          <p>Track invoices, payment attempts, refunds, and delivery updates without leaving your profile.</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner-wrapper"><div className="spinner" /></div>
      ) : orders.length === 0 ? (
        <div className="empty-state compact-empty-state">
          <div className="empty-state-icon">P</div>
          <h3>No purchase history yet</h3>
          <p>Your invoices, payment activity, and delivery updates will appear here after your first order.</p>
        </div>
      ) : (
        <>
          <div className="profile-history-summary">
            <div className="profile-history-stat">
              <span>Invoices</span>
              <strong>{historySummary.invoices}</strong>
            </div>
            <div className="profile-history-stat warning">
              <span>Pending payments</span>
              <strong>{historySummary.pendingPayments}</strong>
            </div>
            <div className="profile-history-stat success">
              <span>Refunds</span>
              <strong>{historySummary.refunds}</strong>
            </div>
            <div className="profile-history-stat info">
              <span>Tracked deliveries</span>
              <strong>{historySummary.deliveries}</strong>
            </div>
          </div>

          <div className="purchase-history-list">
            {orders.map((order) => (
              <PurchaseHistoryCard
                key={order.id}
                order={order}
                user={user}
                expanded={expandedOrderId === order.id}
                onToggle={() => setExpandedOrderId((current) => (current === order.id ? null : order.id))}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default ProfilePurchaseHistory;
