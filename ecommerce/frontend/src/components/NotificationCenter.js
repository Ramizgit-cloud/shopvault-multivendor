import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import './NotificationCenter.css';

const formatTimeAgo = (value) => {
  const createdAt = new Date(value).getTime();
  const diffMinutes = Math.max(Math.floor((Date.now() - createdAt) / 60000), 0);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(value).toLocaleDateString('en-IN');
};

const NotificationCenter = () => {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications,
  } = useNotifications();

  return (
    <div className="notification-center">
      <button
        type="button"
        className="notification-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-label="Open notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.17V11a6 6 0 10-12 0v3.17a2 2 0 01-.6 1.42L4 17h5" />
          <path d="M9 17a3 3 0 006 0" />
        </svg>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-dropdown" onMouseLeave={() => setOpen(false)}>
          <div className="notification-header">
            <div>
              <strong>Inbox</strong>
              <span>{unreadCount} unread</span>
            </div>
            <div className="notification-header-actions">
              {notifications.length > 0 && (
                <>
                  <button type="button" onClick={markAllAsRead}>Mark all read</button>
                  <button type="button" onClick={clearNotifications}>Clear</button>
                </>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="notification-empty">
              <strong>No notifications yet</strong>
              <span>Activity like approvals, cart actions, and order updates will appear here.</span>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((item) => {
                const content = (
                  <>
                    <div className={`notification-dot ${item.tone || 'info'}`} />
                    <div className="notification-copy">
                      <div className="notification-row">
                        <strong>{item.title}</strong>
                        <span>{formatTimeAgo(item.createdAt)}</span>
                      </div>
                      <p>{item.message}</p>
                    </div>
                  </>
                );

                return (
                  <div key={item.id} className={`notification-item ${item.read ? 'read' : ''}`}>
                    {item.link ? (
                      <Link
                        to={item.link}
                        className="notification-link"
                        onClick={() => {
                          markAsRead(item.id);
                          setOpen(false);
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button type="button" className="notification-link" onClick={() => markAsRead(item.id)}>
                        {content}
                      </button>
                    )}
                    <button
                      type="button"
                      className="notification-remove"
                      onClick={() => removeNotification(item.id)}
                      aria-label="Remove notification"
                    >
                      x
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
