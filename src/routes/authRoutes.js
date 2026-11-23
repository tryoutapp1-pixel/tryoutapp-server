const router = require('express').Router();
const controller = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/errorHandler');
const asyncHandler = require('../middlewares/asyncHandler');
const validators = require('../validators/authValidators');

router.post('/signup', validators.signup, validateRequest, asyncHandler(controller.signup));
router.post('/login', validators.login, validateRequest, asyncHandler(controller.login));
router.post('/logout', authenticateToken, controller.logout);
router.get('/verify-email', validators.verifyEmail, validateRequest, asyncHandler(controller.verifyEmail));
router.post('/resend-verification', validators.emailOnly, validateRequest, asyncHandler(controller.resendVerification));
router.post('/forgot-password', validators.emailOnly, validateRequest, asyncHandler(controller.forgotPassword));
router.post('/reset-password', validators.resetPassword, validateRequest, asyncHandler(controller.resetPassword));
router.patch('/change-password', authenticateToken, validators.changePassword, validateRequest, asyncHandler(controller.changePassword));

module.exports = router;
