const multer = require('multer');
const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');

function singleFile(field, maxSize) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxSize, files: 1 } });
  return (req, res, next) => upload.single(field)(req, res, (error) => {
    if (error instanceof multer.MulterError) return next(new ApiError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large' : 'Invalid file upload'));
    if (error) return next(error);
    if (!req.file) return next(new ApiError(400, `${field} is required`));
    next();
  });
}
module.exports = { singleFile };
