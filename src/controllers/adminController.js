const admin = require('../services/adminService');
const content = require('../services/adminContentService');
const storage = require('../services/fileStorageService');

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */

const SIGNED_URL_TTL_SECONDS = 60;

// ---- Assessments and question packages ----

/** @param {Request} req @param {Response} res */
async function createAssessment(req, res) {
  const data = await admin.createAssessment(req.body);
  res.status(201).json({ success: true, message: 'Assessment created successfully', data });
}

/** @param {Request} req @param {Response} res */
async function listAssessments(req, res) {
  res.json({ success: true, data: await admin.listAssessments(req.query) });
}

/** @param {Request} req @param {Response} res */
async function getAssessment(req, res) {
  res.json({ success: true, data: await admin.getAssessment(req.params.id) });
}

/** @param {Request} req @param {Response} res */
async function updateAssessment(req, res) {
  const data = await admin.updateAssessment(req.params.id, req.body);
  res.json({ success: true, message: 'Assessment updated successfully', data });
}

/** @param {Request} req @param {Response} res */
async function release(req, res) {
  const data = await admin.setReleased(req.params.id, true);
  res.json({ success: true, message: 'Assessment released successfully', data });
}

/** @param {Request} req @param {Response} res */
async function unrelease(req, res) {
  const data = await admin.setReleased(req.params.id, false);
  res.json({ success: true, message: 'Assessment unreleased successfully', data });
}

/** @param {Request} req @param {Response} res */
async function createQuestionPackage(req, res) {
  const data = await admin.createQuestionPackage(req.body.assessment_id, req.body.questions);
  res.status(201).json({ success: true, message: 'Question package created successfully', data });
}

/** @param {Request} req @param {Response} res */
async function getQuestionPackage(req, res) {
  res.json({ success: true, data: await admin.getQuestionPackage(req.params.id) });
}

/** @param {Request} req @param {Response} res */
async function updateQuestion(req, res) {
  const data = await admin.updateQuestion(req.params.id, req.body);
  res.json({ success: true, message: 'Question updated successfully', data });
}

/** @param {Request} req @param {Response} res */
async function updateOption(req, res) {
  const data = await admin.updateOption(req.params.id, req.params.optionId, req.body);
  res.json({ success: true, message: 'Option updated successfully', data });
}

// ---- Users ----

/** @param {Request} req @param {Response} res */
async function listUsers(req, res) {
  res.json({ success: true, data: await content.listUsers(req.query) });
}

/** @param {Request} req @param {Response} res */
async function getUser(req, res) {
  res.json({ success: true, data: await content.getUser(req.params.id) });
}

/** @param {Request} req @param {Response} res */
async function suspendUser(req, res) {
  const data = await content.setUserSuspended(req.params.id, true);
  res.json({ success: true, message: 'User suspended successfully', data });
}

/** @param {Request} req @param {Response} res */
async function reactivateUser(req, res) {
  const data = await content.setUserSuspended(req.params.id, false);
  res.json({ success: true, message: 'User reactivated successfully', data });
}

// ---- Images ----

/** @param {Request} req @param {Response} res */
async function listImages(req, res) {
  res.json({ success: true, data: await content.listImages(req.query) });
}

/** @param {Request} req @param {Response} res */
async function createImage(req, res) {
  const data = await content.createImage(req.file);
  res.status(201).json({ success: true, message: 'Image uploaded successfully', data });
}

/** @param {Request} req @param {Response} res */
async function getImage(req, res) {
  const row = await content.getImage(req.params.id);
  res.json({ success: true, data: { url: await storage.getSignedUrl(row.object_key, SIGNED_URL_TTL_SECONDS) } });
}

/** @param {Request} req @param {Response} res */
async function deleteImage(req, res) {
  await content.deleteImage(req.params.id);
  res.json({ success: true, message: 'Image deleted successfully' });
}

// ---- Materials ----

/** @param {Request} req @param {Response} res */
async function listMaterials(req, res) {
  res.json({ success: true, data: await content.listMaterials(req.query) });
}

/** @param {Request} req @param {Response} res */
async function createMaterial(req, res) {
  const data = await content.createMaterial(req.body, req.file);
  res.status(201).json({ success: true, message: 'Material created successfully', data });
}

/** @param {Request} req @param {Response} res */
async function getMaterial(req, res) {
  res.json({ success: true, data: await content.getMaterial(req.params.id) });
}

/** @param {Request} req @param {Response} res */
async function updateMaterial(req, res) {
  const data = await content.updateMaterial(req.params.id, req.body);
  res.json({ success: true, message: 'Material updated successfully', data });
}

/** @param {Request} req @param {Response} res */
async function getMaterialFile(req, res) {
  const row = await content.getMaterialFile(req.params.id);
  res.json({ success: true, data: { url: await storage.getSignedUrl(row.object_key, SIGNED_URL_TTL_SECONDS) } });
}

/** @param {Request} req @param {Response} res */
async function deleteMaterial(req, res) {
  await content.deleteMaterial(req.params.id);
  res.json({ success: true, message: 'Material deleted successfully' });
}

/** @param {Request} req @param {Response} res */
async function setMaterialRelease(req, res) {
  const data = await content.setMaterialReleased(req.params.id, true);
  res.json({ success: true, message: 'Material released successfully', data });
}

/** @param {Request} req @param {Response} res */
async function setMaterialUnrelease(req, res) {
  const data = await content.setMaterialReleased(req.params.id, false);
  res.json({ success: true, message: 'Material unreleased successfully', data });
}

// ---- Feedback ----

/** @param {Request} req @param {Response} res */
async function listFeedback(req, res) {
  res.json({ success: true, data: await content.listFeedback(req.query) });
}

module.exports = {
  createAssessment,
  listAssessments,
  getAssessment,
  updateAssessment,
  release,
  unrelease,
  createQuestionPackage,
  getQuestionPackage,
  updateQuestion,
  updateOption,
  listUsers,
  getUser,
  suspendUser,
  reactivateUser,
  listImages,
  createImage,
  getImage,
  deleteImage,
  listMaterials,
  createMaterial,
  getMaterial,
  updateMaterial,
  getMaterialFile,
  deleteMaterial,
  setMaterialRelease,
  setMaterialUnrelease,
  listFeedback
};
