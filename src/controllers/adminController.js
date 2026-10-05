const admin = require('../services/adminService');

async function createAssessment(req, res) {
  const data = await admin.createAssessment(req.body);
  res.status(201).json({ success: true, message: 'Assessment created successfully', data });
}
async function listAssessments(req, res) {
  const data = await admin.listAssessments({ page: req.query.page || 1, limit: req.query.limit || 20 });
  res.json({ success: true, data });
}
async function getAssessment(req, res) { res.json({ success: true, data: await admin.getAssessment(req.params.id) }); }
async function updateAssessment(req, res) {
  res.json({ success: true, message: 'Assessment updated successfully', data: await admin.updateAssessment(req.params.id, req.body) });
}
async function release(req, res) {
  res.json({ success: true, message: 'Assessment released successfully', data: await admin.setReleased(req.params.id, true) });
}
async function unrelease(req, res) {
  res.json({ success: true, message: 'Assessment unreleased successfully', data: await admin.setReleased(req.params.id, false) });
}
async function createQuestionPackage(req, res) {
  const data = await admin.createQuestionPackage(req.body.assessment_id, req.body.questions);
  res.status(201).json({ success: true, message: 'Question package created successfully', data });
}
async function getQuestionPackage(req, res) {
  res.json({ success: true, data: await admin.getQuestionPackage(req.params.id) });
}
async function updateQuestion(req, res) {
  res.json({ success: true, message: 'Question updated successfully', data: await admin.updateQuestion(req.params.id, req.body) });
}
async function updateOption(req, res) {
  res.json({ success: true, message: 'Option updated successfully', data: await admin.updateOption(req.params.id, req.params.optionId, req.body) });
}
module.exports = { createAssessment, listAssessments, getAssessment, updateAssessment, release, unrelease, createQuestionPackage, getQuestionPackage, updateQuestion, updateOption };
