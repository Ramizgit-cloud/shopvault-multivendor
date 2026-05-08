import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import OrderMessagesThread from '../components/OrderMessagesThread';
import OrderTrackingTimeline from '../components/OrderTrackingTimeline';
import SupportTicketCenter from '../components/SupportTicketCenter';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { orderAPI } from '../services/api';
import { downloadInvoicePdf } from '../utils/invoicePdf';
import './Orders.css';

const statusColors = {
  pending: 'badge-pending',
  confirmed: 'badge-confirmed',
  processing: 'badge-processing',
  shipped: 'badge-shipped',
  delivered: 'badge-delivered',
  cancelled: 'badge-cancelled',
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const { user } = useAuth();
  const { syncOrderNotifications } = useNotifications();
  const returnSummary = useMemo(() => ({
    requested: orders.filter((order) => order.returnRequest?.status === 'pending').length,
    approved: orders.filter((order) => order.returnRequest?.status === 'approved').length,
    refunded: orders.filter((order) => order.payment_status === 'refunded').length,
  }), [orders]);

  const loadOrders = () => {
    setLoading(true);
    orderAPI.getMyOrders()
      .then((response) => {
        setOrders(response.data.orders);
        syncOrderNotifications(response.data.orders);
      })
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, [syncOrderNotifications]);

  const handleRequestCancellation = async (orderId) => {
    const reason = window.prompt('Why do you want to cancel this order?');
    if (reason === null) return;

    try {
      await orderAPI.requestCancellation(orderId, reason.trim());
      toast.success('Cancellation request sent');
      loadOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to request cancellation');
    }
  };

  const handleRequestReturn = async (orderId) => {
    const reason = window.prompt('Why do you want to return this order?');
    if (reason === null) return;

    try {
      await orderAPI.requestReturn(orderId, reason.trim());
      toast.success('Return request sent');
      loadOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to request return');
    }
  };

  const handleInvoiceDownload = (order) => {
    try {
      downloadInvoicePdf(order, user);
      toast.success(`GST bill downloaded for order #${order.id}`);
    } catch {
      toast.error('Failed to generate GST bill');
    }
  };

  if (loading) return <div className="spinner-wrapper"><div className="spinner" /></div>;

  return (
    <div className="container page-content">
      <h1 className="page-title">My Orders</h1>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">P</div>
          <h3>No orders yet</h3>
          <p>Start shopping to see your orders here</p>
          <Link to="/" className="btn btn-primary">Shop Now</Link>
        </div>
      ) : (
        <>
          <div className="returns-overview-grid">
            <div className="card returns-overview-card">
              <span className="returns-overview-label">Return requests</span>
              <strong>{returnSummary.requested}</strong>
            </div>
            <div className="card returns-overview-card success">
              <span className="returns-overview-label">Approved returns</span>
              <strong>{returnSummary.approved}</strong>
            </div>
            <div className="card returns-overview-card info">
              <span className="returns-overview-label">Refunds processed</span>
              <strong>{returnSummary.refunded}</strong>
            </div>
          </div>
          <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card card">
              <div className="order-header" onClick={() => setExpanded(expanded === order.id ? null : order.id)}>
                <div className="order-meta">
                  <span className="order-id">Order #{order.id}</span>
                  <span className={`badge ${statusColors[order.status]}`}>{order.status}</span>
                  <span className={`badge badge-${order.payment_status}`}>{order.payment_status}</span>
                </div>
                <div className="order-summary-right">
                  <span className="order-total">Rs {parseFloat(order.total_price).toFixed(2)}</span>
                  <span className="order-date">{new Date(order.createdAt).toLocaleDateString()}</span>
                  <span className="expand-icon">{expanded === order.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expanded === order.id && (
                <div className="order-details">
                  <hr className="divider" />

                  <OrderTrackingTimeline order={order} />

                  {order.cancellation?.status === 'pending' && (
                    <div className="cancellation-banner pending">
                      <strong>Cancellation requested</strong>
                      <p>{order.cancellation.reason || 'Your request is waiting for vendor or admin review.'}</p>
                    </div>
                  )}

                  {order.cancellation?.status === 'rejected' && (
                    <div className="cancellation-banner rejected">
                      <strong>Cancellation request rejected</strong>
                      <p>{order.cancellation.reason || 'This order will continue as planned.'}</p>
                    </div>
                  )}

                  {order.returnRequest?.status === 'pending' && (
                    <div className="cancellation-banner return-pending">
                      <strong>Return request submitted</strong>
                      <p>{order.returnRequest.reason || 'Your return request is waiting for vendor or admin review.'}</p>
                    </div>
                  )}

                  {order.returnRequest?.status === 'rejected' && (
                    <div className="cancellation-banner return-rejected">
                      <strong>Return request rejected</strong>
                      <p>{order.returnRequest.reason || 'This order is not eligible for a return at the moment.'}</p>
                    </div>
                  )}

                  {order.returnRequest?.status === 'approved' && (
                    <div className="cancellation-banner return-approved">
                      <strong>Return approved</strong>
                      <p>
                        {order.payment_status === 'refunded'
                          ? 'Your refund has been marked on this order.'
                          : 'The return has been approved for this order.'}
                      </p>
                    </div>
                  )}

                  {order.items?.map((item) => (
                    <div key={item.id} className="order-item-row">
                      <div className="order-item-image">
                        {item.product?.image ? <img src={item.product.image} alt={item.product.name} /> : <span>P</span>}
                      </div>
                      <div className="order-item-info">
                        <Link to={`/products/${item.product_id}`} className="order-item-name">{item.product?.name}</Link>
                        {item.variant_label && <span className="order-item-variant">{item.variant_label}</span>}
                        <span className="order-item-qty">Qty: {item.quantity}</span>
                      </div>
                      <span className="order-item-price">Rs {(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}

                  {order.shipping_address && (
                    <p className="order-address"><strong>Ship to:</strong> {order.shipping_address}</p>
                  )}

                  {['pending', 'confirmed', 'processing'].includes(order.status) && order.cancellation?.status !== 'pending' && (
                    <div className="order-help-card">
                      <strong>Need to cancel this order?</strong>
                      <p>
                        Submit a cancellation request here. The seller must approve it before the order is cancelled.
                      </p>
                    </div>
                  )}

                  <div className="order-action-row">
                    <button className="btn btn-outline btn-sm" onClick={() => handleInvoiceDownload(order)}>
                      Download GST Bill
                    </button>
                    {['pending', 'confirmed', 'processing'].includes(order.status) && order.cancellation?.status !== 'pending' && (
                      <button className="btn btn-outline btn-sm" onClick={() => handleRequestCancellation(order.id)}>
                        Request Cancellation
                      </button>
                    )}
                    {order.status === 'delivered' && order.returnRequest?.status !== 'pending' && order.returnRequest?.status !== 'approved' && (
                      <button className="btn btn-outline btn-sm" onClick={() => handleRequestReturn(order.id)}>
                        Request Return
                      </button>
                    )}
                  </div>

                  <OrderMessagesThread orderId={order.id} title="Order Support Thread" />
                  <SupportTicketCenter
                    orderId={order.id}
                    title="Support Tickets"
                    subtitle="Open a structured ticket for delivery issues, refunds, payment concerns, or damaged items."
                    allowCreate
                  />
                </div>
              )}
            </div>
          ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Orders;
