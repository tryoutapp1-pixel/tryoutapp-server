const { param, body, query } = require('express-validator');

/** @param {string} [name='id'] */
const idParam = (name = 'id') => param(name).isInt({ min: 1 }).withMessage(`${name} must be a positive integer`).toInt();

const pagination = [
  query('page').optional().isInt({ min: 1, max: 100000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
];
const positiveId = [idParam()];
const assessmentId = [idParam('assessmentId')];
const attemptId = [idParam('attemptId')];
const explanations = [
  idParam('assessmentId'),
  query('attempt_id').optional().isInt({ min: 1 }).withMessage('attempt_id must be a positive integer').toInt()
];
const answer = [
  idParam('attemptId'),
  body('question_id').isInt({ min: 1 }).toInt(),
  body('selected_option_id').isInt({ min: 1 }).toInt()
];
const feedback = [
  idParam('assessmentId'),
  body('rating').isInt({ min: 1, max: 5 }).toInt(),
  body('difficulty').isIn(['EASY', 'MEDIUM', 'HARD']),
  body('comment').optional({ nullable: true }).isString().isLength({ max: 5000 })
];
const notification = [
  body('order_id').isString().notEmpty(),
  body('status_code').isString().notEmpty(),
  body('gross_amount').isString().notEmpty(),
  body('signature_key').isString().notEmpty(),
  body('transaction_status').isString().notEmpty()
];

module.exports = { pagination, positiveId, assessmentId, attemptId, explanations, answer, feedback, notification };
