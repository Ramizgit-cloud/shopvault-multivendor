const { Order, OrderItem, User } = require('../models');
const {
  createTicketId,
  createSupportTicket,
  updateSupportTicket,
  getSupportTicketById,
  listSupportTickets,
  getMessagesForTicket,
  addMessageToTicket,
} = require('../utils/supportTickets');

const TICKET_CATEGORIES = ['delivery_issue', 'payment_issue', 'cancellation', 'return_refund', 'damaged_item', 'product_issue', 'other'];
const TICKET_PRIORITIES = ['low', 'medium', 'high'];
const TICKET_STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'];

const getTicketAccess = (ticket, user) => {
  if (!ticket || !user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return Number(ticket.customer_id) === Number(user.id);
  if (user.role === 'vendor') {
    return Array.isArray(ticket.vendor_options) && ticket.vendor_options.some((vendor) => Number(vendor.id) === Number(user.id));
  }
  return false;
};

const serializeTicket = (ticket, messages = null) => ({
  ...ticket,
  messagesCount: Number(ticket.messagesCount || 0),
  messages,
});

const buildTicketSummary = async (ticket) => {
  const messages = await getMessagesForTicket(ticket.id);
  return {
    ...ticket,
    messagesCount: messages.length,
    lastMessagePreview: messages.length ? messages[messages.length - 1].body.slice(0, 120) : ticket.description,
  };
};

const getOrderForCustomerTicket = async (orderId, user) => Order.findOne({
  where: {
    id: orderId,
    user_id: user.id,
  },
  include: [{
    model: OrderItem,
    as: 'items',
    attributes: ['id', 'vendor_id'],
    include: [{ model: User, as: 'vendorUser', attributes: ['id', 'name'] }],
  }],
});

const listTickets = async (req, res, next) => {
  try {
    const { order_id } = req.query;
    const tickets = await listSupportTickets((ticket) => {
      if (!getTicketAccess(ticket, req.user)) return false;
      if (order_id && Number(ticket.order_id) !== Number(order_id)) return false;
      return true;
    });

    const hydrated = await Promise.all(tickets.map(buildTicketSummary));
    res.json({ success: true, tickets: hydrated });
  } catch (error) {
    next(error);
  }
};

const createTicket = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Only customers can create support tickets' });
    }

    const {
      order_id,
      subject,
      category,
      priority = 'medium',
      description,
    } = req.body;

    if (!order_id) {
      return res.status(400).json({ success: false, message: 'Order is required' });
    }

    if (!String(subject || '').trim()) {
      return res.status(400).json({ success: false, message: 'Subject is required' });
    }

    if (!String(description || '').trim()) {
      return res.status(400).json({ success: false, message: 'Describe the issue' });
    }

    if (!TICKET_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket category' });
    }

    if (!TICKET_PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket priority' });
    }

    const order = await getOrderForCustomerTicket(order_id, req.user);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const vendorOptions = Array.from(new Map(
      (order.items || [])
        .filter((item) => item.vendorUser)
        .map((item) => [Number(item.vendorUser.id), { id: Number(item.vendorUser.id), name: item.vendorUser.name }]),
    ).values());

    const createdAt = new Date().toISOString();
    const assignedRole = vendorOptions.length === 1 ? 'vendor' : 'admin';
    const assignedVendor = vendorOptions.length === 1 ? vendorOptions[0] : null;
    const ticket = await createSupportTicket({
      id: createTicketId(),
      order_id: Number(order_id),
      customer_id: Number(req.user.id),
      customer_name: req.user.name,
      subject: String(subject).trim(),
      category,
      priority,
      status: 'open',
      description: String(description).trim(),
      assigned_role: assignedRole,
      assigned_vendor_id: assignedVendor?.id || null,
      assigned_vendor_name: assignedVendor?.name || null,
      vendor_options: vendorOptions,
      createdAt,
      updatedAt: createdAt,
      lastMessageAt: createdAt,
    });

    const initialMessage = await addMessageToTicket({
      ticketId: ticket.id,
      user: req.user,
      body: ticket.description,
    });

    res.status(201).json({
      success: true,
      message: 'Support ticket created',
      ticket: serializeTicket({ ...ticket, messagesCount: 1 }, [initialMessage]),
    });
  } catch (error) {
    next(error);
  }
};

const getTicket = async (req, res, next) => {
  try {
    const ticket = await getSupportTicketById(req.params.id);
    if (!ticket || !getTicketAccess(ticket, req.user)) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const messages = await getMessagesForTicket(ticket.id);
    res.json({
      success: true,
      ticket: serializeTicket({ ...ticket, messagesCount: messages.length }, messages),
    });
  } catch (error) {
    next(error);
  }
};

const sendTicketMessage = async (req, res, next) => {
  try {
    const ticket = await getSupportTicketById(req.params.id);
    if (!ticket || !getTicketAccess(ticket, req.user)) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const message = await addMessageToTicket({
      ticketId: ticket.id,
      user: req.user,
      body: req.body?.body,
    });

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    res.status(201).json({ success: true, message: 'Reply sent', ticketMessage: message });
  } catch (error) {
    next(error);
  }
};

const updateTicketManagement = async (req, res, next) => {
  try {
    const ticket = await getSupportTicketById(req.params.id);
    if (!ticket || !getTicketAccess(ticket, req.user)) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const { status, priority, category, assigned_role, assigned_vendor_id } = req.body;
    const nextValues = { ...ticket };

    if (status !== undefined) {
      if (!TICKET_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid ticket status' });
      }
      if (req.user.role === 'customer' && !['closed', 'open'].includes(status)) {
        return res.status(403).json({ success: false, message: 'Customers can only reopen or close their tickets' });
      }
      nextValues.status = status;
    }

    if (req.user.role === 'admin') {
      if (priority !== undefined) {
        if (!TICKET_PRIORITIES.includes(priority)) {
          return res.status(400).json({ success: false, message: 'Invalid ticket priority' });
        }
        nextValues.priority = priority;
      }

      if (category !== undefined) {
        if (!TICKET_CATEGORIES.includes(category)) {
          return res.status(400).json({ success: false, message: 'Invalid ticket category' });
        }
        nextValues.category = category;
      }

      if (assigned_role !== undefined) {
        if (!['admin', 'vendor'].includes(assigned_role)) {
          return res.status(400).json({ success: false, message: 'Invalid assignment role' });
        }

        nextValues.assigned_role = assigned_role;
        if (assigned_role === 'admin') {
          nextValues.assigned_vendor_id = null;
          nextValues.assigned_vendor_name = null;
        } else {
          const selectedVendor = (ticket.vendor_options || []).find((vendor) => Number(vendor.id) === Number(assigned_vendor_id));
          if (!selectedVendor) {
            return res.status(400).json({ success: false, message: 'Choose a valid vendor assignment' });
          }
          nextValues.assigned_vendor_id = selectedVendor.id;
          nextValues.assigned_vendor_name = selectedVendor.name;
        }
      }
    }

    nextValues.updatedAt = new Date().toISOString();
    const updated = await updateSupportTicket(ticket.id, nextValues);
    const messages = await getMessagesForTicket(ticket.id);

    res.json({
      success: true,
      message: 'Ticket updated',
      ticket: serializeTicket({ ...updated, messagesCount: messages.length }, messages),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTickets,
  createTicket,
  getTicket,
  sendTicketMessage,
  updateTicketManagement,
};
