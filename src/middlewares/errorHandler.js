const { validationResult } = require('express-validator');
const { env } = require('../config/env');

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('express').NextFunction} NextFunction */

/**
 * Responds 400 with the express-validator errors collected by earlier chains.
 *
 * @param {Request} req @param {Response} res @param {NextFunction} next
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  return next();
}

/** @param {Request} req @param {Response} res */
function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Route not found' });
}

/**
 * Central error handler. Client errors (ApiError and body-parser errors) keep
 * their message; anything else is logged and returned as a generic 500. The
 * stack trace is only included in development.
 *
 * @param {any} err @param {Request} req @param {Response} res @param {NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const candidate = Number(err.statusCode || err.status);
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate < 600 ? candidate : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    message: status >= 500 ? 'Internal server error' : err.message,
    ...(env.nodeEnv === 'development' && status >= 500 && { stack: err.stack })
  });
}

module.exports = { validateRequest, notFound, errorHandler };
