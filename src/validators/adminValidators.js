const { body, param, query } = require('express-validator');

const MAX_SAFE_ID = Number.MAX_SAFE_INTEGER;
const MAX_SCORE = 99999999.99;
const idParam = (field = 'id') => param(field).isInt({ min: 1, max: MAX_SAFE_ID }).withMessage(`${field} must be a positive integer`);
const textBytes = (maxBytes) => (value) => Buffer.byteLength(value, 'utf8') <= maxBytes;
const decimalScore = (value) => /^\d+(?:\.\d{1,2})?$/.test(String(value));
const assessmentCreate = [
  body('title').isString().trim().notEmpty().isLength({ max: 255 }),
  body('description').optional({ nullable: true }).isString().bail().custom(textBytes(65535)),
  body('type').isIn(['TRYOUT', 'LATIHAN']),
  body('access_type').optional().isIn(['FREE', 'PREMIUM']),
  body('duration_minutes').optional({ nullable: true }).isInt({ min: 1, max: 4294967295 }).toInt(),
  body('passing_score_twk').optional().isFloat({ min: 0, max: MAX_SCORE }).bail().toFloat().custom(decimalScore),
  body('passing_score_tiu').optional().isFloat({ min: 0, max: MAX_SCORE }).bail().toFloat().custom(decimalScore),
  body('passing_score_tkp').optional().isFloat({ min: 0, max: MAX_SCORE }).bail().toFloat().custom(decimalScore)
];
const assessmentUpdate = [
  idParam(), body('title').optional().isString().trim().notEmpty().isLength({ max: 255 }),
  body('description').optional({ nullable: true }).isString().bail().custom(textBytes(65535)),
  body('type').optional().isIn(['TRYOUT', 'LATIHAN']),
  body('access_type').optional().isIn(['FREE', 'PREMIUM']),
  body('duration_minutes').optional({ nullable: true }).isInt({ min: 1, max: 4294967295 }).toInt(),
  body('passing_score_twk').optional().isFloat({ min: 0, max: MAX_SCORE }).bail().toFloat().custom(decimalScore),
  body('passing_score_tiu').optional().isFloat({ min: 0, max: MAX_SCORE }).bail().toFloat().custom(decimalScore),
  body('passing_score_tkp').optional().isFloat({ min: 0, max: MAX_SCORE }).bail().toFloat().custom(decimalScore),
  body().custom((value) => ['title', 'description', 'type', 'access_type', 'duration_minutes', 'passing_score_twk', 'passing_score_tiu', 'passing_score_tkp'].some((key) => Object.prototype.hasOwnProperty.call(value, key))).withMessage('At least one editable field is required')
];
const assessmentId = [idParam()];
const assessmentList = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
];

const questionPackageCreate = [
  body('assessment_id').isInt({ min: 1, max: MAX_SAFE_ID }).withMessage('assessment_id must be a positive integer').toInt(),
  body('questions').isArray({ min: 1, max: 65535 }).withMessage('questions must contain between one and 65535 questions'),
  body('questions.*.question_text').isString().bail().trim().notEmpty().bail().custom(textBytes(65535)),
  body('questions.*.question_type').isIn(['TWK', 'TIU', 'TKP']),
  body('questions.*.explanation').optional({ nullable: true }).isString().bail().custom(textBytes(65535)),
  body('questions.*.image_attachment_id').optional({ nullable: true }).isInt({ min: 1, max: MAX_SAFE_ID }).toInt(),
  body('questions.*.explanation_attachment_id').optional({ nullable: true }).isInt({ min: 1, max: MAX_SAFE_ID }).toInt(),
  body('questions.*.options').isArray({ min: 1, max: 5 }).withMessage('each question must contain between one and five options'),
  body('questions.*.options.*.option_text').isString().bail().trim().notEmpty().bail().custom(textBytes(65535)),
  body('questions.*.options.*.score').isFloat({ min: 0, max: MAX_SCORE }).bail().toFloat().custom(decimalScore),
  body('questions.*.options.*.image_attachment_id').optional({ nullable: true }).isInt({ min: 1, max: MAX_SAFE_ID }).toInt()
];

const questionUpdate = [
  idParam(),
  body('question_text').optional().isString().bail().trim().notEmpty().bail().custom(textBytes(65535)),
  body('question_type').optional().isIn(['TWK', 'TIU', 'TKP']),
  body('explanation').optional({ nullable: true }).isString().bail().custom(textBytes(65535)),
  body('image_attachment_id').optional({ nullable: true }).isInt({ min: 1, max: MAX_SAFE_ID }).toInt(),
  body('explanation_attachment_id').optional({ nullable: true }).isInt({ min: 1, max: MAX_SAFE_ID }).toInt(),
  body().custom((value) => ['question_text', 'question_type', 'explanation', 'image_attachment_id', 'explanation_attachment_id'].some((key) => Object.prototype.hasOwnProperty.call(value, key))).withMessage('At least one editable field is required')
];
const optionUpdate = [
  idParam('id'), idParam('optionId'),
  body('option_text').optional().isString().bail().trim().notEmpty().bail().custom(textBytes(65535)),
  body('score').optional().isFloat({ min: 0, max: MAX_SCORE }).bail().toFloat().custom(decimalScore),
  body('image_attachment_id').optional({ nullable: true }).isInt({ min: 1, max: MAX_SAFE_ID }).toInt(),
  body('option_order').optional().isInt({ min: 1, max: 4 }).toInt(),
  body().custom((value) => ['option_text', 'score', 'image_attachment_id', 'option_order'].some((key) => Object.prototype.hasOwnProperty.call(value, key))).withMessage('At least one editable field is required')
];
module.exports = { assessmentCreate, assessmentUpdate, assessmentId, assessmentList, questionPackageCreate, questionUpdate, optionUpdate };
