const router = require('express').Router();
const controller = require('../controllers/userController');
const { authenticateToken, authorizeRoles, requireActiveStatus } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/errorHandler');
const { updateProfile } = require('../validators/userValidators');
const api = require('../controllers/userApiController');
const v = require('../validators/userApiValidators');
// Every USER-domain route requires an authenticated USER whose account is ACTIVE.
// requireActiveStatus blocks suspended accounts immediately (JWTs have no expiry).
const userAuth = [authenticateToken, authorizeRoles('USER'), requireActiveStatus];

router.get('/me', authenticateToken, requireActiveStatus, controller.getMe);
router.patch('/me', authenticateToken, requireActiveStatus, updateProfile, validateRequest, controller.updateMe);

router.get('/premium/offer', userAuth, api.offer);
router.get('/subscription', userAuth, api.subscription);
router.post('/premium/payment', userAuth, api.createPayment);
router.get('/transactions', userAuth, v.pagination, validateRequest, api.history);
router.get('/materials', userAuth, v.pagination, validateRequest, api.materials);
router.get('/materials/:id', userAuth, v.positiveId, validateRequest, api.material);
router.get('/latihan', userAuth, v.pagination, validateRequest, api.assessments('LATIHAN'));
router.get('/latihan/:assessmentId', userAuth, v.assessmentId, validateRequest, api.assessment('LATIHAN'));
router.post('/latihan/:assessmentId/attempts', userAuth, v.assessmentId, validateRequest, api.start('LATIHAN'));
router.get('/tryout', userAuth, v.pagination, validateRequest, api.assessments('TRYOUT'));
router.get('/tryout/statistics', userAuth, api.statistics);
router.get('/tryout/:assessmentId', userAuth, v.assessmentId, validateRequest, api.assessment('TRYOUT'));
router.post('/tryout/:assessmentId/attempts', userAuth, v.assessmentId, validateRequest, api.start('TRYOUT'));
router.get('/attempts/:attemptId', userAuth, v.attemptId, validateRequest, api.attempt);
router.post('/attempts/:attemptId/answers', userAuth, v.answer, validateRequest, api.answer);
router.post('/attempts/:attemptId/submit', userAuth, v.attemptId, validateRequest, api.submit);
router.get('/latihan/attempts/:attemptId/result', userAuth, v.attemptId, validateRequest, api.result('LATIHAN'));
router.get('/tryout/attempts/:attemptId/result', userAuth, v.attemptId, validateRequest, api.result('TRYOUT'));
router.get('/latihan/:assessmentId/explanations', userAuth, v.assessmentId, validateRequest, api.explanations('LATIHAN'));
router.get('/tryout/:assessmentId/explanations', userAuth, v.assessmentId, validateRequest, api.explanations('TRYOUT'));
router.post('/assessments/:assessmentId/feedback', userAuth, v.feedback, validateRequest, api.feedback);

module.exports = router;
