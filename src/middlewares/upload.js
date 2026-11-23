const multer = require('multer');
const ApiError = require('../utils/ApiError');

/**
 * Accepts exactly one in-memory file in `field`, up to `maxSize` bytes, and
 * maps multer errors to ApiError (413 for size, 400 otherwise).
 *
 * @param {string} field - Multipart field name
 * @param {number} maxSize - Maximum size in bytes
 * @returns {import('express').RequestHandler}
 */
function singleFile(field, maxSize) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxSize, files: 1 } });
  return (req, res, next) => upload.single(field)(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      return next(new ApiError(tooLarge ? 413 : 400, tooLarge ? 'Uploaded file is too large' : 'Invalid file upload'));
    }
    if (error) return next(error);
    if (!req.file) return next(new ApiError(400, `${field} is required`));
    return next();
  });
}

module.exports = { singleFile };
