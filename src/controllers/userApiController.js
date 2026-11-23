const service = require('../services/userApiService');

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('../services/userApiService')} UserApiService */
/** @typedef {'LATIHAN'|'TRYOUT'} AssessmentType */

/**
 * Handlers are plain async functions; routes wrap them with asyncHandler so a
 * rejected promise reaches the central error handler.
 */

/** @param {Request} req */
const userId = (req) => req.user.id;

/** @param {Request} req @param {Response} res */
async function offer(req, res) {
  res.json({ success: true, data: await service.offer() });
}

/** @param {Request} req @param {Response} res */
async function subscription(req, res) {
  res.json({ success: true, data: await service.getSubscription(userId(req)) });
}

/** @param {Request} req @param {Response} res */
async function createPayment(req, res) {
  res.status(201).json({ success: true, data: await service.createPayment(userId(req)) });
}

/** @param {Request} req @param {Response} res */
async function history(req, res) {
  res.json({ success: true, data: await service.transactionHistory(userId(req), req.query) });
}

/** @param {Request} req @param {Response} res */
async function notification(req, res) {
  res.json({ success: true, data: await service.midtransNotification(req.body) });
}

/** @param {Request} req @param {Response} res */
async function materials(req, res) {
  res.json({ success: true, data: await service.listMaterials(req.query) });
}

/** @param {Request} req @param {Response} res */
async function material(req, res) {
  res.json({ success: true, data: await service.materialDetail(userId(req), req.params.id) });
}

/** @param {AssessmentType} type */
function assessments(type) {
  /** @param {Request} req @param {Response} res */
  return async (req, res) => {
    res.json({ success: true, data: await service.assessmentList(type, req.query) });
  };
}

/** @param {AssessmentType} type */
function assessment(type) {
  /** @param {Request} req @param {Response} res */
  return async (req, res) => {
    res.json({ success: true, data: await service.assessmentDetail(userId(req), type, req.params.assessmentId) });
  };
}

/** @param {AssessmentType} type */
function start(type) {
  /** @param {Request} req @param {Response} res */
  return async (req, res) => {
    res.status(201).json({ success: true, data: await service.startAttempt(userId(req), type, req.params.assessmentId) });
  };
}

/** @param {AssessmentType} type */
function attemptHistory(type) {
  /** @param {Request} req @param {Response} res */
  return async (req, res) => {
    res.json({ success: true, data: await service.attemptHistory(userId(req), type, req.params.assessmentId) });
  };
}

/** @param {Request} req @param {Response} res */
async function attempt(req, res) {
  res.json({ success: true, data: await service.getAttempt(userId(req), req.params.attemptId) });
}

/** @param {Request} req @param {Response} res */
async function answer(req, res) {
  const { question_id: questionId, selected_option_id: optionId } = req.body;
  res.json({ success: true, data: await service.saveAnswer(userId(req), req.params.attemptId, questionId, optionId) });
}

/** @param {Request} req @param {Response} res */
async function submit(req, res) {
  res.json({ success: true, data: await service.submitAttempt(userId(req), req.params.attemptId) });
}

/** @param {AssessmentType} type */
function result(type) {
  /** @param {Request} req @param {Response} res */
  return async (req, res) => {
    res.json({ success: true, data: await service.result(userId(req), type, req.params.attemptId) });
  };
}

/** @param {AssessmentType} type */
function explanations(type) {
  /** @param {Request} req @param {Response} res */
  return async (req, res) => {
    const data = await service.explanations(userId(req), type, req.params.assessmentId, req.query.attempt_id);
    res.json({ success: true, data });
  };
}

/** @param {Request} req @param {Response} res */
async function feedback(req, res) {
  res.status(201).json({ success: true, data: await service.createFeedback(userId(req), req.params.assessmentId, req.body) });
}

/** @param {Request} req @param {Response} res */
async function statistics(req, res) {
  res.json({ success: true, data: await service.statistics(userId(req)) });
}

module.exports = {
  offer,
  subscription,
  createPayment,
  history,
  notification,
  materials,
  material,
  assessments,
  assessment,
  start,
  attemptHistory,
  attempt,
  answer,
  submit,
  result,
  explanations,
  feedback,
  statistics
};
