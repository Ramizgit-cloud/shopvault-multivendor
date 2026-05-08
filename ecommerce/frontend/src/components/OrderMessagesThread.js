import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { orderAPI } from '../services/api';
import './OrderMessagesThread.css';

const formatMessageTime = (value) => new Date(value).toLocaleString('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

const OrderMessagesThread = ({ orderId, title = 'Support Messages', compact = false }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    orderAPI.getMessages(orderId)
      .then((response) => {
        if (active) setMessages(response.data.messages || []);
      })
      .catch((error) => {
        if (active) toast.error(error.response?.data?.message || 'Failed to load support messages');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!draft.trim()) return;

    setSending(true);
    try {
      const response = await orderAPI.sendMessage(orderId, draft.trim());
      setMessages((current) => [...current, response.data.threadMessage]);
      setDraft('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`order-messages card ${compact ? 'compact' : ''}`}>
      <div className="order-messages-header">
        <div>
          <h3>{title}</h3>
          <p>Buyer, seller, and admin can coordinate here for this order.</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner-wrapper"><div className="spinner" /></div>
      ) : messages.length === 0 ? (
        <div className="order-messages-empty">No messages yet. Start the conversation if you need help with this order.</div>
      ) : (
        <div className="order-messages-list">
          {messages.map((message) => (
            <div key={message.id} className={`message-bubble ${message.author_id === user?.id ? 'own' : ''}`}>
              <div className="message-meta">
                <strong>{message.author_name}</strong>
                <span className={`message-role role-${message.author_role}`}>{message.author_role}</span>
                <time>{formatMessageTime(message.createdAt)}</time>
              </div>
              <p>{message.body}</p>
            </div>
          ))}
        </div>
      )}

      <form className="order-message-form" onSubmit={handleSend}>
        <textarea
          className="form-input"
          rows={compact ? 2 : 3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message about this order..."
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={sending}>
          {sending ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  );
};

export default OrderMessagesThread;
