const { body, param, query } = require('express-validator');

const MAX_SAFE_ID = Number.MAX_SAFE_INTEGER;
const MAX_SCORE = 99999999.99;
const MAX_TEXT_BYTES = 65535;
const ASSESSMENT_TYPES = ['TRYOUT', 'LATIHAN'];
const ACCESS_TYPES = ['FREE', 'PREMIUM'];
const QUESTION_TYPES = ['TWK', 'TIU', 'TKP'];

/** @param {string} [field='id'] */
const idParam = (field = 'id') => param(field).isInt({ min: 1, max: MAX_SAFE_ID }).withMessage(`${field} must be a positive integer`);
/** @param {number} maxBytes */
const textBytes = (maxBytes) => (value) => Buffer.byteLength(value, 'utf8') <= maxBytes;
/** @param {unknown} value */
const decimalScore = (value) => /^\d+(?:\.\d{1,2})?$/.test(String(value));
/** @param {string[]} keys - Passes when the body contains at least one of them. */
const hasAnyField = (keys) => (value) => keys.some((key) => Object.prototype.hasOwnProperty.call(value, key));
/** @param {string} field */
const optionalText = (field) => body(field).optional({ nullable: true }).isString().bail().custom(textBytes(MAX_TEXT_BYTES));
/** @param {string} field */
const requiredText = (field) => body(field).isString().bail().trim().notEmpty().bail().custom(textBytes(MAX_TEXT_BYTES));
/** @param {string} field */
const score = (field) => body(field).isFloat({ min: 0, max: MAX_SCORE }).bail().toFloat().custom(decimalScore);
/** @param {string} field */
const optionalAttachmentId = (field) => body(field).optional({ nullable: true }).isInt({ min: 1, max: MAX_SAFE_ID }).toInt();

const pagination = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
];

const ASSESSMENT_FIELDS = ['title', 'description', 'type', 'access_type', 'duration_minutes', 'passing_score_twk', 'passing_score_tiu', 'passing_score_tkp'];
const assessmentCreate = [
  body('title').isString().trim().notEmpty().isLength({ max: 255 }),
  optionalText('description'),
  body('type').isIn(ASSESSMENT_TYPES),
  body('access_type').optional().isIn(ACCESS_TYPES),
  body('duration_minutes').optional({ nullable: true }).isInt({ min: 1, max: 4294967295 }).toInt(),
  score('passing_score_twk').optional(),
  score('passing_score_tiu').optional(),
  score('passing_score_tkp').optional()
];
const assessmentUpdate = [
  idParam(),
  body('title').optional().isString().trim().notEmpty().isLength({ max: 255 }),
  optionalText('description'),
  body('type').optional().isIn(ASSESSMENT_TYPES),
  body('access_type').optional().isIn(ACCESS_TYPES),
  body('duration_minutes').optional({ nullable: true }).isInt({ min: 1, max: 4294967295 }).toInt(),
  score('passing_score_twk').optional(),
  score('passing_score_tiu').optional(),
  score('passing_score_tkp').optional(),
  body().custom(hasAnyField(ASSESSMENT_FIELDS)).withMessage('At least one editable field is required')
];
const assessmentId = [idParam()];
const assessmentList = pagination;
const userList = pagination;
const contentId = [idParam()];

const materialList = pagination;
const materialCreate = [
  body('title').isString().trim().notEmpty().isLength({ max: 255 }),
  optionalText('description'),
  body('type').isIn(QUESTION_TYPES).withMessage('type must be TWK, TIU, or TKP'),
  body('access_type').optional().isIn(ACCESS_TYPES)
];
const materialUpdate = [
  idParam(),
  body('title').optional().isString().trim().notEmpty().isLength({ max: 255 }),
  optionalText('description'),
  body('type').optional().isIn(QUESTION_TYPES).withMessage('type must be TWK, TIU, or TKP'),
  body('access_type').optional().isIn(ACCESS_TYPES),
  body().custom(hasAnyField(['title', 'description', 'type', 'access_type'])).withMessage('At least one editable field is required')
];
const materialRelease = [idParam()];

const feedbackList = [
  ...pagination,
  query('assessment_id').optional().isInt({ min: 1, max: MAX_SAFE_ID }).toInt(),
  query('assessment_type').optional().isIn(ASSESSMENT_TYPES),
  query('rating').optional().isInt({ min: 1, max: 5 }).toInt(),
  query('difficulty').optional().isIn(['EASY', 'MEDIUM', 'HARD'])
];

const questionPackageCreate = [
  body('assessment_id').isInt({ min: 1, max: MAX_SAFE_ID }).withMessage('assessment_id must be a positive integer').toInt(),
  body('questions').isArray({ min: 1, max: 65535 }).withMessage('questions must contain between one and 65535 questions'),
  requiredText('questions.*.question_text'),
  body('questions.*.question_type').isIn(QUESTION_TYPES),
  optionalText('questions.*.explanation'),
  optionalAttachmentId('questions.*.image_attachment_id'),
  optionalAttachmentId('questions.*.explanation_attachment_id'),
  body('questions.*.options').isArray({ min: 1, max: 5 }).withMessage('each question must contain between one and five options'),
  requiredText('questions.*.options.*.option_text'),
  score('questions.*.options.*.score'),
  optionalAttachmentId('questions.*.options.*.image_attachment_id')
];

const QUESTION_FIELDS = ['question_text', 'question_type', 'explanation', 'image_attachment_id', 'explanation_attachment_id'];
const questionUpdate = [
  idParam(),
  requiredText('question_text').optional(),
  body('question_type').optional().isIn(QUESTION_TYPES),
  optionalText('explanation'),
  optionalAttachmentId('image_attachment_id'),
  optionalAttachmentId('explanation_attachment_id'),
  body().custom(hasAnyField(QUESTION_FIELDS)).withMessage('At least one editable field is required')
];

const OPTION_FIELDS = ['option_text', 'score', 'image_attachment_id', 'option_order'];
const optionUpdate = [
  idParam('id'),
  idParam('optionId'),
  requiredText('option_text').optional(),
  score('score').optional(),
  optionalAttachmentId('image_attachment_id'),
  body('option_order').optional().isInt({ min: 1, max: 5 }).toInt(),
  body().custom(hasAnyField(OPTION_FIELDS)).withMessage('At least one editable field is required')
];

module.exports = {
  assessmentCreate,
  assessmentUpdate,
  assessmentId,
  assessmentList,
  questionPackageCreate,
  questionUpdate,
  optionUpdate,
  userList,
  contentId,
  materialList,
  materialCreate,
  materialUpdate,
  materialRelease,
  feedbackList
};
