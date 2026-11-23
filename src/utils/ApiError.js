/**
 * An expected, client-facing error. The central error handler returns its
 * `statusCode`, `message`, and optional machine-readable `code` as-is; any
 * other error becomes a generic 500.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Safe to show to the client
   * @param {string} [code] - Optional application error code, e.g. 'EMAIL_PENDING_VERIFICATION'
   */
  constructor(statusCode, message, code) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    if (code) this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
