const validatePassword = (password) => {
  const value = String(password || '');
  const failures = [];

  if (value.length < 10) failures.push('at least 10 characters');
  if (!/[a-z]/.test(value)) failures.push('one lowercase letter');
  if (!/[A-Z]/.test(value)) failures.push('one uppercase letter');
  if (!/[0-9]/.test(value)) failures.push('one number');
  if (!/[^A-Za-z0-9]/.test(value)) failures.push('one special character');

  return {
    valid: failures.length === 0,
    message: failures.length
      ? `Password must include ${failures.join(', ')}`
      : 'Password is valid',
  };
};

module.exports = { validatePassword };
