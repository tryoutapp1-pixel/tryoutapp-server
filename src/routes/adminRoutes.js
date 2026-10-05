const router = require('express').Router();
const controller = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/errorHandler');
const asyncHandler = require('../middlewares/asyncHandler');
const validators = require('../validators/adminValidators');

router.use(authenticateToken, authorizeRoles('ADMIN'));
router.post('/assessments', validators.assessmentCreate, validateRequest, asyncHandler(controller.createAssessment));
router.get('/assessments', validators.assessmentList, validateRequest, asyncHandler(controller.listAssessments));
router.get('/assessments/:id', validators.assessmentId, validateRequest, asyncHandler(controller.getAssessment));
router.patch('/assessments/:id', validators.assessmentUpdate, validateRequest, asyncHandler(controller.updateAssessment));
router.post('/assessments/:id/release', validators.assessmentId, validateRequest, asyncHandler(controller.release));
router.post('/assessments/:id/unrelease', validators.assessmentId, validateRequest, asyncHandler(controller.unrelease));
router.post('/question-packages', validators.questionPackageCreate, validateRequest, asyncHandler(controller.createQuestionPackage));
router.get('/assessments/:id/question-package', validators.assessmentId, validateRequest, asyncHandler(controller.getQuestionPackage));
router.patch('/questions/:id', validators.questionUpdate, validateRequest, asyncHandler(controller.updateQuestion));
router.patch('/questions/:id/options/:optionId', validators.optionUpdate, validateRequest, asyncHandler(controller.updateOption));

module.exports = router;
