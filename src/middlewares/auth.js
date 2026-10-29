const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const pool = require('../config/database');

function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication token is required' });
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret);
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid authentication token' });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ success: false, message: 'Forbidden' });
}

// Blocks suspended (or otherwise non-ACTIVE) accounts at request time. Because
// JWTs here have no expiry, this is what makes an admin suspend take effect
// immediately for an already-logged-in user. One lightweight status lookup.
async function requireActiveStatus(req, res, next) {
  try {
    const [rows] = await pool.execute('SELECT status FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(401).json({ success: false, message: 'Account no longer exists' });
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Your account is not active. Please contact support.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticateToken, authorizeRoles, requireActiveStatus };
