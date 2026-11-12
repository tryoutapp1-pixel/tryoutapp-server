const router = require('express').Router();
const controller = require('../controllers/userApiController');
const { validateRequest } = require('../middlewares/errorHandler');
const asyncHandler = require('../middlewares/asyncHandler');
const validators = require('../validators/userApiValidators');

// Midtrans calls this webhook directly; it is authenticated by signature, not JWT.
router.post('/midtrans/notification', validators.notification, validateRequest, asyncHandler(controller.notification));

module.exports = router;
