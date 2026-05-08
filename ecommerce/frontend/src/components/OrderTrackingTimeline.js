import React from 'react';
import { getTrackingFeed, getTrackingProgress } from '../utils/orderTracking';
import { getOrderEstimatedDelivery } from '../utils/deliveryEstimate';
import './OrderTrackingTimeline.css';

const formatTimestamp = (value) => {
  if (!value) return 'Pending update';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const OrderTrackingTimeline = ({ order, compact = false, showFeed = true }) => {
  const progress = getTrackingProgress(order);
  const feed = getTrackingFeed(order);
  const estimatedDelivery = getOrderEstimatedDelivery(order);

  return (
    <div className={`order-tracking card ${compact ? 'compact' : ''}`}>
      <div className="order-tracking-header">
        <div>
          <h3>Tracking Timeline</h3>
          <p>Current status: <strong>{order.status}</strong></p>
          {estimatedDelivery && (
            <>
              <div className={`delivery-status-banner ${estimatedDelivery.message?.tone || 'warm'}`}>
                <strong>{estimatedDelivery.message?.title || estimatedDelivery.label}</strong>
                <span>{estimatedDelivery.message?.detail || estimatedDelivery.detail}</span>
              </div>
              <div className="delivery-estimate-inline">
                <strong>{estimatedDelivery.label}</strong>
                <span>{estimatedDelivery.detail}</span>
              </div>
            </>
          )}
        </div>
        <span className={`timeline-status-chip ${order.status}`}>{order.status}</span>
      </div>

      <div className="timeline-steps">
        {progress.map((step, index) => (
          <div key={step.key} className={`timeline-step ${step.state}`}>
            <div className="timeline-rail">
              <div className="timeline-dot">
                {step.state === 'done' ? '✓' : index + 1}
              </div>
              {index < progress.length - 1 && <div className="timeline-line" />}
            </div>
            <div className="timeline-content">
              <div className="timeline-title-row">
                <h4>{step.title}</h4>
                {step.state === 'current' && <span className="timeline-live">Current</span>}
              </div>
              <p>{step.description}</p>
              <span className="timeline-date">{formatTimestamp(step.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>

      {showFeed && feed.length > 0 && (
        <div className="timeline-feed">
          <div className="timeline-feed-header">
            <h4>Recent updates</h4>
            <span>{feed.length} event{feed.length > 1 ? 's' : ''}</span>
          </div>
          <div className="timeline-feed-list">
            {[...feed].reverse().map((event) => (
              <div key={event.key} className="timeline-feed-item">
                <div className="timeline-feed-meta">
                  <strong>{event.title}</strong>
                  <span>{formatTimestamp(event.timestamp)}</span>
                </div>
                <p>{event.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderTrackingTimeline;
