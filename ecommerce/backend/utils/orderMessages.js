const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'order-messages.json');
const MAX_MESSAGES = 2000;

const ensureMessagesFile = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(MESSAGES_FILE);
  } catch {
    await fs.writeFile(MESSAGES_FILE, '[]', 'utf8');
  }
};

const readMessages = async () => {
  await ensureMessagesFile();
  try {
    const raw = await fs.readFile(MESSAGES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeMessages = async (messages) => {
  await ensureMessagesFile();
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages.slice(0, MAX_MESSAGES), null, 2), 'utf8');
};

const getMessagesForOrder = async (orderId) => {
  const messages = await readMessages();
  return messages
    .filter((message) => Number(message.order_id) === Number(orderId))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

const addMessageToOrder = async ({ orderId, user, body }) => {
  const trimmed = String(body || '').trim();
  if (!trimmed) return null;

  const messages = await readMessages();
  const entry = {
    id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    order_id: Number(orderId),
    author_id: Number(user.id),
    author_name: user.name,
    author_role: user.role,
    body: trimmed,
    createdAt: new Date().toISOString(),
  };

  messages.push(entry);
  await writeMessages(messages);
  return entry;
};

module.exports = {
  getMessagesForOrder,
  addMessageToOrder,
};
