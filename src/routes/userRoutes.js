const router = require('express').Router();
const profile = require('../controllers/userController');
const api = require('../controllers/userApiController');
const { authenticateToken, authorizeRoles, requireActiveStatus } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/errorHandler');
const asyncHandler = require('../middlewares/asyncHandler');
const { updateProfile } = require('../validators/userValidators');
const v = require('../validators/userApiValidators');

// Every USER-domain route requires an authenticated USER whose account is ACTIVE.
// requireActiveStatus blocks suspended accounts immediately (JWTs have no expiry).
const userAuth = [authenticateToken, authorizeRoles('USER'), requireActiveStatus];

router.get('/me', authenticateToken, requireActiveStatus, asyncHandler(profile.getMe));
router.patch('/me', authenticateToken, requireActiveStatus, updateProfile, validateRequest, asyncHandler(profile.updateMe));

// Subscription and payment
router.get('/premium/offer', userAuth, asyncHandler(api.offer));
router.get('/subscription', userAuth, asyncHandler(api.subscription));
router.post('/premium/payment', userAuth, asyncHandler(api.createPayment));
router.get('/transactions', userAuth, v.pagination, validateRequest, asyncHandler(api.history));

// Materials
router.get('/materials', userAuth, v.pagination, validateRequest, asyncHandler(api.materials));
router.get('/materials/:id', userAuth, v.positiveId, validateRequest, asyncHandler(api.material));

// Latihan and Try Out share the same handlers, parameterized by assessment type.
// Static segments (statistics, attempts) are registered before /:assessmentId.
router.get('/tryout/statistics', userAuth, asyncHandler(api.statistics));
for (const [segment, type] of [['latihan', 'LATIHAN'], ['tryout', 'TRYOUT']]) {
  router.get(`/${segment}`, userAuth, v.pagination, validateRequest, asyncHandler(api.assessments(type)));
  router.get(`/${segment}/attempts/:attemptId/result`, userAuth, v.attemptId, validateRequest, asyncHandler(api.result(type)));
  router.get(`/${segment}/:assessmentId`, userAuth, v.assessmentId, validateRequest, asyncHandler(api.assessment(type)));
  router.get(`/${segment}/:assessmentId/attempts`, userAuth, v.assessmentId, validateRequest, asyncHandler(api.attemptHistory(type)));
  router.post(`/${segment}/:assessmentId/attempts`, userAuth, v.assessmentId, validateRequest, asyncHandler(api.start(type)));
  router.get(`/${segment}/:assessmentId/explanations`, userAuth, v.explanations, validateRequest, asyncHandler(api.explanations(type)));
}

// Attempt engine
router.get('/attempts/:attemptId', userAuth, v.attemptId, validateRequest, asyncHandler(api.attempt));
router.post('/attempts/:attemptId/answers', userAuth, v.answer, validateRequest, asyncHandler(api.answer));
router.post('/attempts/:attemptId/submit', userAuth, v.attemptId, validateRequest, asyncHandler(api.submit));

router.post('/assessments/:assessmentId/feedback', userAuth, v.feedback, validateRequest, asyncHandler(api.feedback));

module.exports = router;
