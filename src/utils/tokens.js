const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function expiryDate(hours = 24) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

module.exports = { generateToken, hashToken, expiryDate };
