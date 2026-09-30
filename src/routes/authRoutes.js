const router = require('express').Router();
const controller = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/errorHandler');
const validators = require('../validators/authValidators');

router.post('/signup', validators.signup, validateRequest, controller.signup);
router.post('/login', validators.login, validateRequest, controller.login);
router.post('/logout', authenticateToken, controller.logout);
router.get('/verify-email', validators.verifyEmail, validateRequest, controller.verifyEmail);
router.post('/resend-verification', validators.emailOnly, validateRequest, controller.resendVerification);
router.post('/forgot-password', validators.emailOnly, validateRequest, controller.forgotPassword);
router.post('/reset-password', validators.resetPassword, validateRequest, controller.resetPassword);
router.patch('/change-password', authenticateToken, validators.changePassword, validateRequest, controller.changePassword);

module.exports = router;
