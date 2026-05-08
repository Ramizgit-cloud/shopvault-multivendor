import React from 'react';

const OrderTable = ({ orders, onToggleReview }) => (
  <div className="products-table-wrap">
    <table className="data-table">
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Items</th>
          <th>Total</th>
          <th>Status</th>
          <th>Payment</th>
          <th>Risk</th>
          <th>Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td>#{order.id}</td>
            <td>
              <div>{order.customer?.name}</div>
              <div className="table-muted">{order.customer?.email}</div>
            </td>
            <td>{order.items?.length || 0}</td>
            <td>Rs {parseFloat(order.total_price).toFixed(2)}</td>
            <td><span className={`badge badge-${order.status}`}>{order.status}</span></td>
            <td><span className={`badge badge-${order.payment_status}`}>{order.payment_status}</span></td>
            <td>
              <div className="table-risk-stack">
                {order.manualReview?.flagged && <span className="badge badge-critical">Manual review</span>}
                {order.suspiciousSignals?.map((signal) => (
                  <span key={signal.code} className={`badge badge-${signal.severity || 'warning'}`}>{signal.label}</span>
                ))}
                {order.manualReview?.reason && <div className="table-muted">{order.manualReview.reason}</div>}
                {!order.manualReview?.reason && order.suspiciousSignals?.[0]?.message && (
                  <div className="table-muted">{order.suspiciousSignals[0].message}</div>
                )}
              </div>
            </td>
            <td>{new Date(order.createdAt).toLocaleDateString()}</td>
            <td>
              <button
                className={`btn btn-sm ${order.manualReview?.flagged ? 'btn-outline' : 'btn-primary'}`}
                onClick={() => onToggleReview(order)}
              >
                {order.manualReview?.flagged ? 'Clear flag' : 'Flag review'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default OrderTable;
