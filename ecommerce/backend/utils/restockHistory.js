const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'restock-history.json');
const MAX_ENTRIES = 500;

const ensureHistoryFile = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(HISTORY_FILE);
  } catch {
    await fs.writeFile(HISTORY_FILE, '[]', 'utf8');
  }
};

const readHistory = async () => {
  await ensureHistoryFile();
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeHistory = async (entries) => {
  await ensureHistoryFile();
  await fs.writeFile(HISTORY_FILE, JSON.stringify(entries.slice(0, MAX_ENTRIES), null, 2), 'utf8');
};

const buildVariantSummary = (variants = []) => variants
  .filter((variant) => variant && variant.label)
  .map((variant) => ({
    id: variant.id,
    label: variant.label,
    stock: Number(variant.stock || 0),
  }));

const recordRestockEvent = async ({
  vendorId,
  productId,
  productName,
  previousStock,
  nextStock,
  changeType,
  source = 'manual',
  previousVariants = [],
  nextVariants = [],
}) => {
  const prevValue = Number(previousStock || 0);
  const nextValue = Number(nextStock || 0);
  const delta = nextValue - prevValue;

  if (delta === 0 && JSON.stringify(buildVariantSummary(previousVariants)) === JSON.stringify(buildVariantSummary(nextVariants))) {
    return null;
  }

  const entry = {
    id: `restock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    vendor_id: vendorId,
    product_id: productId,
    product_name: productName,
    previous_stock: prevValue,
    next_stock: nextValue,
    delta,
    change_type: changeType,
    source,
    previous_variants: buildVariantSummary(previousVariants),
    next_variants: buildVariantSummary(nextVariants),
    createdAt: new Date().toISOString(),
  };

  const entries = await readHistory();
  entries.unshift(entry);
  await writeHistory(entries);
  return entry;
};

const getVendorRestockHistory = async (vendorId, limit = 20) => {
  const entries = await readHistory();
  return entries
    .filter((entry) => Number(entry.vendor_id) === Number(vendorId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
};

const getAllRestockHistory = async (limit = MAX_ENTRIES) => {
  const entries = await readHistory();
  return entries
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
};

module.exports = {
  recordRestockEvent,
  getVendorRestockHistory,
  getAllRestockHistory,
};
