import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { supportAPI } from '../services/api';
import './SupportTicketCenter.css';

const categoryOptions = [
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'payment_issue', label: 'Payment Issue' },
  { value: 'cancellation', label: 'Cancellation' },
  { value: 'return_refund', label: 'Return / Refund' },
  { value: 'damaged_item', label: 'Damaged Item' },
  { value: 'product_issue', label: 'Product Issue' },
  { value: 'other', label: 'Other' },
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_customer', label: 'Waiting Customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const initialForm = {
  subject: '',
  category: 'delivery_issue',
  priority: 'medium',
  description: '',
};

const formatDateTime = (value) => new Date(value).toLocaleString('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

const SupportTicketCenter = ({
  orderId = null,
  title = 'Support Tickets',
  subtitle = 'Track customer issues with categories, assignments, and status updates.',
  allowCreate = false,
  compact = false,
}) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [replying, setReplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [draft, setDraft] = useState('');

  const canManageAssignments = user?.role === 'admin';
  const canManageStatus = ['admin', 'vendor', 'customer'].includes(user?.role);

  const loadTickets = async (preferredTicketId = null) => {
    setLoading(true);
    try {
      const response = await supportAPI.listTickets(orderId ? { order_id: orderId } : {});
      const nextTickets = response.data.tickets || [];
      setTickets(nextTickets);
      const fallbackId = preferredTicketId || selectedTicketId || nextTickets[0]?.id || null;
      setSelectedTicketId((current) => {
        if (preferredTicketId) return preferredTicketId;
        if (current && nextTickets.some((ticket) => ticket.id === current)) return current;
        return fallbackId;
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [orderId]);

  useEffect(() => {
    if (!selectedTicketId) {
      setSelectedTicket(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    supportAPI.getTicket(selectedTicketId)
      .then((response) => {
        if (active) setSelectedTicket(response.data.ticket || null);
      })
      .catch((error) => {
        if (active) toast.error(error.response?.data?.message || 'Failed to load ticket details');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedTicketId]);

  const selectedAssignmentLabel = useMemo(() => {
    if (!selectedTicket) return '';
    if (selectedTicket.assigned_role === 'vendor') {
      return selectedTicket.assigned_vendor_name || 'Assigned vendor';
    }
    return 'Admin queue';
  }, [selectedTicket]);

  const handleCreateTicket = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await supportAPI.createTicket({
        order_id: orderId,
        ...form,
      });
      const createdTicket = response.data.ticket;
      setCreateOpen(false);
      setForm(initialForm);
      await loadTickets(createdTicket.id);
      setSelectedTicket(createdTicket);
      setSelectedTicketId(createdTicket.id);
      toast.success('Support ticket created');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create support ticket');
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async (event) => {
    event.preventDefault();
    if (!draft.trim() || !selectedTicket) return;

    setReplying(true);
    try {
      const response = await supportAPI.sendMessage(selectedTicket.id, draft.trim());
      const ticketMessage = response.data.ticketMessage;
      setSelectedTicket((current) => ({
        ...current,
        messages: [...(current?.messages || []), ticketMessage],
      }));
      setTickets((current) => current.map((ticket) => (
        ticket.id === selectedTicket.id
          ? { ...ticket, updatedAt: ticketMessage.createdAt, lastMessageAt: ticketMessage.createdAt, messagesCount: Number(ticket.messagesCount || 0) + 1 }
          : ticket
      )));
      setDraft('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  const handleSaveManagement = async (overrides = {}) => {
    if (!selectedTicket) return;
    setSaving(true);
    try {
      const response = await supportAPI.updateTicket(selectedTicket.id, overrides);
      const updatedTicket = response.data.ticket;
      setSelectedTicket(updatedTicket);
      setTickets((current) => current.map((ticket) => (
        ticket.id === updatedTicket.id
          ? { ...ticket, ...updatedTicket }
          : ticket
      )));
      toast.success('Ticket updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update ticket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`support-ticket-center card ${compact ? 'compact' : ''}`}>
      <div className="support-ticket-header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {allowCreate && user?.role === 'customer' && orderId && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setCreateOpen((current) => !current)}>
            {createOpen ? 'Cancel' : 'Open Ticket'}
          </button>
        )}
      </div>

      {createOpen && (
        <form className="support-ticket-form" onSubmit={handleCreateTicket}>
          <div className="support-ticket-grid">
            <input
              className="form-input"
              value={form.subject}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
              placeholder="Short subject"
              required
            />
            <select
              className="form-input form-select"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            >
              {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select
              className="form-input form-select"
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
            >
              {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label} Priority</option>)}
            </select>
          </div>
          <textarea
            className="form-input"
            rows={3}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Describe the issue in detail..."
            required
          />
          <div className="action-btns">
            <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
              {creating ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="spinner-wrapper"><div className="spinner" /></div>
      ) : tickets.length === 0 ? (
        <div className="order-messages-empty">No support tickets yet.</div>
      ) : (
        <div className="support-ticket-layout">
          <div className="support-ticket-list">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                className={`support-ticket-item ${selectedTicketId === ticket.id ? 'active' : ''}`}
                onClick={() => setSelectedTicketId(ticket.id)}
              >
                <div className="support-ticket-item-top">
                  <strong>{ticket.subject}</strong>
                  <span className={`message-role role-${ticket.assigned_role === 'vendor' ? 'vendor' : 'admin'}`}>{ticket.status}</span>
                </div>
                <div className="support-ticket-item-meta">
                  <span>{categoryOptions.find((option) => option.value === ticket.category)?.label || ticket.category}</span>
                  <span>{ticket.priority}</span>
                  <span>{ticket.messagesCount || 0} messages</span>
                </div>
                <p>{ticket.lastMessagePreview || ticket.description}</p>
              </button>
            ))}
          </div>

          <div className="support-ticket-detail">
            {detailLoading || !selectedTicket ? (
              <div className="spinner-wrapper"><div className="spinner" /></div>
            ) : (
              <>
                <div className="support-ticket-detail-head">
                  <div>
                    <h4>{selectedTicket.subject}</h4>
                    <div className="support-ticket-pill-row">
                      <span className="message-role">{categoryOptions.find((option) => option.value === selectedTicket.category)?.label || selectedTicket.category}</span>
                      <span className="message-role">{selectedTicket.priority} priority</span>
                      <span className="message-role">{selectedAssignmentLabel}</span>
                      <span className="message-role">Order #{selectedTicket.order_id}</span>
                    </div>
                  </div>
                  <div className="support-ticket-manage">
                    {canManageStatus && (
                      <select
                        className="form-input form-select"
                        value={selectedTicket.status}
                        disabled={saving}
                        onChange={(event) => handleSaveManagement({ status: event.target.value })}
                      >
                        {statusOptions
                          .filter((option) => user?.role !== 'customer' || ['open', 'closed'].includes(option.value))
                          .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    )}

                    {canManageAssignments && (
                      <>
                        <select
                          className="form-input form-select"
                          value={selectedTicket.priority}
                          disabled={saving}
                          onChange={(event) => handleSaveManagement({ priority: event.target.value })}
                        >
                          {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label} Priority</option>)}
                        </select>
                        <select
                          className="form-input form-select"
                          value={`${selectedTicket.assigned_role}:${selectedTicket.assigned_vendor_id || 'queue'}`}
                          disabled={saving}
                          onChange={(event) => {
                            const [assigned_role, assigned_vendor_id] = event.target.value.split(':');
                            handleSaveManagement({
                              assigned_role,
                              assigned_vendor_id: assigned_vendor_id === 'queue' ? null : Number(assigned_vendor_id),
                            });
                          }}
                        >
                          <option value="admin:queue">Admin Queue</option>
                          {(selectedTicket.vendor_options || []).map((vendor) => (
                            <option key={vendor.id} value={`vendor:${vendor.id}`}>Assign to {vendor.name}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                </div>

                <div className="order-messages-list support-ticket-messages">
                  {(selectedTicket.messages || []).map((message) => (
                    <div key={message.id} className={`message-bubble ${message.author_id === user?.id ? 'own' : ''}`}>
                      <div className="message-meta">
                        <strong>{message.author_name}</strong>
                        <span className={`message-role role-${message.author_role}`}>{message.author_role}</span>
                        <time>{formatDateTime(message.createdAt)}</time>
                      </div>
                      <p>{message.body}</p>
                    </div>
                  ))}
                </div>

                <form className="order-message-form" onSubmit={handleReply}>
                  <textarea
                    className="form-input"
                    rows={compact ? 2 : 3}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Reply on this ticket..."
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={replying}>
                    {replying ? 'Sending...' : 'Send Reply'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportTicketCenter;
