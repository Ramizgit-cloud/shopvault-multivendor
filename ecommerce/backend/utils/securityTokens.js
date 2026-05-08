const crypto = require('crypto');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createTokenPair = () => {
  const plainToken = crypto.randomBytes(32).toString('hex');

  return {
    plainToken,
    hashedToken: hashToken(plainToken),
  };
};

module.exports = { createTokenPair, hashToken };
