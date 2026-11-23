const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const pool = require('../config/database');

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('express').NextFunction} NextFunction */
/** @typedef {'USER'|'ADMIN'} Role */

/**
 * Verifies the Bearer JWT and sets `req.user = { id, role }`.
 *
 * @param {Request} req @param {Response} res @param {NextFunction} next
 */
function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication token is required' });
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret);
    req.user = { id: payload.userId, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid authentication token' });
  }
}

/**
 * Allows the request only when `req.user.role` is one of `roles`.
 *
 * @param {...Role} roles
 * @returns {import('express').RequestHandler}
 */
function authorizeRoles(...roles) {
  return (req, res, next) => (roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ success: false, message: 'Forbidden' }));
}

/**
 * Blocks suspended (or otherwise non-ACTIVE) accounts at request time. JWTs
 * have no expiry, so this is what makes an admin suspension take effect
 * immediately for a user who is already logged in.
 *
 * @param {Request} req @param {Response} res @param {NextFunction} next
 */
async function requireActiveStatus(req, res, next) {
  try {
    const [[user]] = await pool.execute('SELECT status FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (!user) return res.status(401).json({ success: false, message: 'Account no longer exists' });
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Your account is not active. Please contact support.' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { authenticateToken, authorizeRoles, requireActiveStatus };
