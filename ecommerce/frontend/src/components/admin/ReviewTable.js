import React from 'react';

const ReviewTable = ({ reviews, onDelete }) => (
  <div className="products-table-wrap">
    <table className="data-table">
      <thead>
        <tr>
          <th>Review</th>
          <th>Reviewer</th>
          <th>Product</th>
          <th>Rating</th>
          <th>Trust</th>
          <th>Signals</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {reviews.map((review) => (
          <tr key={review.id}>
            <td>
              <div className="review-admin-cell">
                <strong>{review.comment?.trim() || 'Rating-only review'}</strong>
                <div className="table-muted">
                  {new Date(review.createdAt).toLocaleDateString()} {review.updatedAt !== review.createdAt ? '· edited' : ''}
                </div>
              </div>
            </td>
            <td>
              <div className="review-admin-cell">
                <strong>{review.reviewer?.name || 'Unknown user'}</strong>
                <div className="table-muted">{review.reviewer?.email || 'No email'}</div>
              </div>
            </td>
            <td>
              <div className="product-cell">
                <div className="product-cell-img">{review.product?.image ? <img src={review.product.image} alt={review.product?.name} /> : 'P'}</div>
                <div>
                  <span>{review.product?.name || 'Removed product'}</span>
                  <div className="table-muted">{review.product?.category || 'Uncategorized'}</div>
                </div>
              </div>
            </td>
            <td>
              <span className="badge badge-confirmed">{review.rating}/5</span>
            </td>
            <td>
              <div className="table-risk-stack">
                <span className={`badge ${review.verifiedPurchase ? 'badge-healthy' : 'badge-warning'}`}>
                  {review.verifiedPurchase ? 'Verified purchase' : 'Unverified'}
                </span>
              </div>
            </td>
            <td>
              <div className="table-risk-stack">
                {review.moderationSignals?.length ? review.moderationSignals.map((signal) => (
                  <span key={`${review.id}-${signal.code}`} className={`badge badge-${signal.severity === 'warning' ? 'warning' : signal.severity === 'critical' ? 'critical' : 'confirmed'}`}>
                    {signal.message}
                  </span>
                )) : (
                  <span className="badge badge-healthy">No obvious signals</span>
                )}
              </div>
            </td>
            <td>
              <button className="btn btn-danger btn-sm" onClick={() => onDelete(review.id)}>
                Remove
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ReviewTable;
