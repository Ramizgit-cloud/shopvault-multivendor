const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isValidEmail = (email) => emailRegex.test(normalizeEmail(email));

module.exports = { normalizeEmail, isValidEmail };
