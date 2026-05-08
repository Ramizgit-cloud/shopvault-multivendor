const MAX_SAVED_ADDRESSES = 5;
const STORAGE_PREFIX = 'shopvault.addressBook';

const normalizeText = (value) => String(value ?? '').trim();

const slugifyLabel = (value) => normalizeText(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const createAddressEntry = (entry = {}, index = 0) => {
  const normalizedValue = normalizeText(entry.value);
  const normalizedLabel = normalizeText(entry.label);
  const source = entry.source === 'profile' ? 'profile' : 'saved';

  return {
    id: entry.id || `${source}-${slugifyLabel(normalizedLabel || `address-${index + 1}`)}-${index + 1}`,
    label: normalizedLabel || (source === 'profile' ? 'Primary Address' : `Saved Address ${index + 1}`),
    value: normalizedValue,
    source,
  };
};

const getStorageKey = (userId) => `${STORAGE_PREFIX}.${userId}`;

const dedupeEntries = (entries) => {
  const seen = new Set();

  return entries.filter((entry) => {
    const normalizedValue = normalizeText(entry.value).toLowerCase();
    if (!normalizedValue || seen.has(normalizedValue)) return false;
    seen.add(normalizedValue);
    return true;
  });
};

const getAddressBook = (user) => {
  if (!user?.id) return [];

  let persistedEntries = [];
  try {
    const raw = localStorage.getItem(getStorageKey(user.id));
    persistedEntries = raw ? JSON.parse(raw) : [];
  } catch {
    persistedEntries = [];
  }

  const savedEntries = Array.isArray(persistedEntries)
    ? persistedEntries
      .map((entry, index) => createAddressEntry({ ...entry, source: 'saved' }, index))
      .filter((entry) => entry.value)
      .slice(0, MAX_SAVED_ADDRESSES)
    : [];

  const primaryAddress = normalizeText(user.address);
  const profileEntries = primaryAddress
    ? [createAddressEntry({
      id: `profile-${user.id}`,
      label: 'Primary Address',
      value: primaryAddress,
      source: 'profile',
    })]
    : [];

  return dedupeEntries([...profileEntries, ...savedEntries]);
};

const saveAddressBook = (userId, entries) => {
  if (!userId) return;

  const savedEntries = Array.isArray(entries)
    ? dedupeEntries(
      entries
        .filter((entry) => entry?.source !== 'profile')
        .map((entry, index) => createAddressEntry({ ...entry, source: 'saved' }, index)),
    ).slice(0, MAX_SAVED_ADDRESSES)
    : [];

  localStorage.setItem(getStorageKey(userId), JSON.stringify(savedEntries));
};

export { createAddressEntry, getAddressBook, MAX_SAVED_ADDRESSES, saveAddressBook };
