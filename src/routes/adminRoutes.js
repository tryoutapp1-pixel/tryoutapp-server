const router = require('express').Router();
const controller = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/errorHandler');
const asyncHandler = require('../middlewares/asyncHandler');
const validators = require('../validators/adminValidators');
const { singleFile } = require('../middlewares/upload');
const { env } = require('../config/env');

router.use(authenticateToken, authorizeRoles('ADMIN'));

// Users
router.get('/users', validators.userList, validateRequest, asyncHandler(controller.listUsers));
router.get('/users/:id', validators.contentId, validateRequest, asyncHandler(controller.getUser));
router.patch('/users/:id/suspend', validators.contentId, validateRequest, asyncHandler(controller.suspendUser));
router.patch('/users/:id/reactivate', validators.contentId, validateRequest, asyncHandler(controller.reactivateUser));

// Images
router.get('/images', validators.userList, validateRequest, asyncHandler(controller.listImages));
router.post('/images', singleFile('file', env.maxImageSize), asyncHandler(controller.createImage));
router.get('/images/:id', validators.contentId, validateRequest, asyncHandler(controller.getImage));
router.delete('/images/:id', validators.contentId, validateRequest, asyncHandler(controller.deleteImage));

// Materials
router.get('/materials', validators.materialList, validateRequest, asyncHandler(controller.listMaterials));
router.post('/materials', singleFile('file', env.maxMaterialSize), validators.materialCreate, validateRequest, asyncHandler(controller.createMaterial));
router.get('/materials/:id/file', validators.contentId, validateRequest, asyncHandler(controller.getMaterialFile));
router.get('/materials/:id', validators.contentId, validateRequest, asyncHandler(controller.getMaterial));
router.patch('/materials/:id', validators.materialUpdate, validateRequest, asyncHandler(controller.updateMaterial));
router.delete('/materials/:id', validators.contentId, validateRequest, asyncHandler(controller.deleteMaterial));
router.patch('/materials/:id/release', validators.materialRelease, validateRequest, asyncHandler(controller.setMaterialRelease));
router.patch('/materials/:id/unrelease', validators.materialRelease, validateRequest, asyncHandler(controller.setMaterialUnrelease));

// Assessments and question packages
router.post('/assessments', validators.assessmentCreate, validateRequest, asyncHandler(controller.createAssessment));
router.get('/assessments', validators.assessmentList, validateRequest, asyncHandler(controller.listAssessments));
router.get('/assessments/:id', validators.assessmentId, validateRequest, asyncHandler(controller.getAssessment));
router.patch('/assessments/:id', validators.assessmentUpdate, validateRequest, asyncHandler(controller.updateAssessment));
router.post('/assessments/:id/release', validators.assessmentId, validateRequest, asyncHandler(controller.release));
router.post('/assessments/:id/unrelease', validators.assessmentId, validateRequest, asyncHandler(controller.unrelease));
router.get('/assessments/:id/question-package', validators.assessmentId, validateRequest, asyncHandler(controller.getQuestionPackage));
router.post('/question-packages', validators.questionPackageCreate, validateRequest, asyncHandler(controller.createQuestionPackage));
router.patch('/questions/:id', validators.questionUpdate, validateRequest, asyncHandler(controller.updateQuestion));
router.patch('/questions/:id/options/:optionId', validators.optionUpdate, validateRequest, asyncHandler(controller.updateOption));

// Feedback
router.get('/feedback', validators.feedbackList, validateRequest, asyncHandler(controller.listFeedback));

module.exports = router;
