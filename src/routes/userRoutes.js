const router = require('express').Router();
const controller = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/errorHandler');
const { updateProfile } = require('../validators/userValidators');

router.get('/me', authenticateToken, controller.getMe);
router.patch('/me', authenticateToken, updateProfile, validateRequest, controller.updateMe);

module.exports = router;
