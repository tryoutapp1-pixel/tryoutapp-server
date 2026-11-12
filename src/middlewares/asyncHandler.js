/**
 * Wraps an async route handler so a rejected promise is passed to `next` and
 * reaches the central error handler instead of becoming an unhandled rejection.
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => unknown} handler
 * @returns {import('express').RequestHandler}
 */
module.exports = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
