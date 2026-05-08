import React from 'react';

const ReturnTable = ({ orders, onDecision }) => (
  <div className="products-table-wrap">
    <table className="data-table">
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Reason</th>
          <th>Requested</th>
          <th>Status</th>
          <th>Refund</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td>#{order.id}</td>
            <td>{order.customer?.name}</td>
            <td>{order.returnRequest?.reason || 'Customer requested a return'}</td>
            <td>{order.returnRequest?.requestedAt ? new Date(order.returnRequest.requestedAt).toLocaleDateString() : '-'}</td>
            <td>
              <span className={`badge badge-${order.returnRequest?.status === 'pending' ? 'processing' : order.returnRequest?.status === 'approved' ? 'delivered' : 'cancelled'}`}>
                {order.returnRequest?.status}
              </span>
            </td>
            <td>
              <span className={`badge badge-${order.payment_status}`}>{order.payment_status}</span>
            </td>
            <td>
              {order.returnRequest?.status === 'pending' ? (
                <div className="action-btns">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => onDecision(order.id, 'approve')}>Approve</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => onDecision(order.id, 'reject')}>Reject</button>
                </div>
              ) : (
                <span className="table-muted">
                  {order.returnRequest?.status === 'approved' ? 'Resolved with refund flow' : 'Closed'}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ReturnTable;
