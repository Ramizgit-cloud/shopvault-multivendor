import React from 'react';

const PaymentTable = ({ payments }) => (
  <div className="products-table-wrap">
    <table className="data-table">
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Amount</th>
          <th>Payment ID</th>
          <th>Method</th>
          <th>Status</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((payment) => (
          <tr key={payment.order_id}>
            <td>#{payment.order_id}</td>
            <td>{payment.customer?.name}</td>
            <td>Rs {parseFloat(payment.amount).toFixed(2)}</td>
            <td>{payment.payment_id}</td>
            <td>{payment.method}</td>
            <td><span className={`badge badge-${payment.status}`}>{payment.status}</span></td>
            <td>{new Date(payment.updatedAt || payment.createdAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default PaymentTable;
