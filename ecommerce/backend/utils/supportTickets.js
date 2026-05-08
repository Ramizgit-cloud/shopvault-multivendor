const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TICKETS_FILE = path.join(DATA_DIR, 'support-tickets.json');
const TICKET_MESSAGES_FILE = path.join(DATA_DIR, 'support-ticket-messages.json');
const MAX_TICKETS = 2000;
const MAX_MESSAGES = 5000;

const ensureSupportFiles = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await Promise.all([
    fs.access(TICKETS_FILE).catch(() => fs.writeFile(TICKETS_FILE, '[]', 'utf8')),
    fs.access(TICKET_MESSAGES_FILE).catch(() => fs.writeFile(TICKET_MESSAGES_FILE, '[]', 'utf8')),
  ]);
};

const readJsonArray = async (filePath) => {
  await ensureSupportFiles();
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeJsonArray = async (filePath, rows, limit) => {
  await ensureSupportFiles();
  await fs.writeFile(filePath, JSON.stringify(rows.slice(0, limit), null, 2), 'utf8');
};

const readTickets = async () => readJsonArray(TICKETS_FILE);
const readTicketMessages = async () => readJsonArray(TICKET_MESSAGES_FILE);
const writeTickets = async (tickets) => writeJsonArray(TICKETS_FILE, tickets, MAX_TICKETS);
const writeTicketMessages = async (messages) => writeJsonArray(TICKET_MESSAGES_FILE, messages, MAX_MESSAGES);

const createTicketId = () => `ticket_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const createMessageId = () => `ticket_msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const createSupportTicket = async (ticket) => {
  const tickets = await readTickets();
  tickets.push(ticket);
  await writeTickets(tickets);
  return ticket;
};

const updateSupportTicket = async (ticketId, updater) => {
  const tickets = await readTickets();
  let updatedTicket = null;

  const nextTickets = tickets.map((ticket) => {
    if (ticket.id !== ticketId) return ticket;
    updatedTicket = typeof updater === 'function' ? updater(ticket) : { ...ticket, ...updater };
    return updatedTicket;
  });

  if (!updatedTicket) return null;
  await writeTickets(nextTickets);
  return updatedTicket;
};

const getSupportTicketById = async (ticketId) => {
  const tickets = await readTickets();
  return tickets.find((ticket) => ticket.id === ticketId) || null;
};

const listSupportTickets = async (predicate = () => true) => {
  const tickets = await readTickets();
  return tickets
    .filter(predicate)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
};

const getMessagesForTicket = async (ticketId) => {
  const messages = await readTicketMessages();
  return messages
    .filter((message) => message.ticket_id === ticketId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

const addMessageToTicket = async ({ ticketId, user, body, internal = false }) => {
  const trimmed = String(body || '').trim();
  if (!trimmed) return null;

  const messages = await readTicketMessages();
  const entry = {
    id: createMessageId(),
    ticket_id: ticketId,
    author_id: Number(user.id),
    author_name: user.name,
    author_role: user.role,
    body: trimmed,
    internal: Boolean(internal),
    createdAt: new Date().toISOString(),
  };

  messages.push(entry);
  await writeTicketMessages(messages);

  await updateSupportTicket(ticketId, (ticket) => ({
    ...ticket,
    updatedAt: entry.createdAt,
    lastMessageAt: entry.createdAt,
  }));

  return entry;
};

module.exports = {
  createTicketId,
  createSupportTicket,
  updateSupportTicket,
  getSupportTicketById,
  listSupportTickets,
  getMessagesForTicket,
  addMessageToTicket,
};
