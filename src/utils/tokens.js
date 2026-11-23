const crypto = require('node:crypto');

/** @returns {string} 64-char hex token for email links */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Only the SHA-256 hash of a token is stored in the database.
 *
 * @param {string} token
 * @returns {string}
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * @param {number} [hours=24]
 * @returns {Date} Now plus `hours`
 */
function expiryDate(hours = 24) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

module.exports = { generateToken, hashToken, expiryDate };
