/**
 * An expected, client-facing error. The central error handler returns its
 * `statusCode` and `message` as-is; any other error becomes a generic 500.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Safe to show to the client
   */
  constructor(statusCode, message) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
