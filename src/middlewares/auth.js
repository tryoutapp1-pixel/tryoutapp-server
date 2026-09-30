const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

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

module.exports = { authenticateToken, authorizeRoles };
