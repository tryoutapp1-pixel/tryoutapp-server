const admin = require('../services/adminService');
const content = require('../services/adminContentService');
const storage = require('../services/fileStorageService');

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
async function listUsers(req, res) { res.json({ success: true, data: await content.listUsers({ page: req.query.page || 1, limit: req.query.limit || 20 }) }); }
async function getUser(req, res) { res.json({ success: true, data: await content.getUser(req.params.id) }); }
async function listImages(req, res) { res.json({ success: true, data: await content.listImages({ page: req.query.page || 1, limit: req.query.limit || 20 }) }); }
async function createImage(req, res) { res.status(201).json({ success: true, message: 'Image uploaded successfully', data: await content.createImage(req.file) }); }
async function getImage(req, res) {
  const row = await content.getImage(req.params.id);
  res.json({ success: true, data: { url: await storage.getSignedUrl(row.object_key, 60) } });
}
async function deleteImage(req, res) { await content.deleteImage(req.params.id); res.json({ success: true, message: 'Image deleted successfully' }); }
async function listMaterials(req, res) { res.json({ success: true, data: await content.listMaterials({ page: req.query.page || 1, limit: req.query.limit || 20 }) }); }
async function createMaterial(req, res) { res.status(201).json({ success: true, message: 'Material created successfully', data: await content.createMaterial(req.body, req.file) }); }
async function getMaterial(req, res) { res.json({ success: true, data: await content.getMaterial(req.params.id) }); }
async function getMaterialFile(req, res) {
  const row = await content.getMaterialFile(req.params.id);
  res.json({ success: true, data: { url: await storage.getSignedUrl(row.object_key, 60) } });
}
async function deleteMaterial(req, res) { await content.deleteMaterial(req.params.id); res.json({ success: true, message: 'Material deleted successfully' }); }


async function setMaterialRelease(req, res) {
  res.json({ success: true, message: 'Material released successfully', data: await content.setMaterialReleased(req.params.id, true) });
}
async function setMaterialUnrelease(req, res) {
  res.json({ success: true, message: 'Material unreleased successfully', data: await content.setMaterialReleased(req.params.id, false) });
}
// async function setMaterialReleased(req, res) { res.json({ success: true, message: `Material ${req.body.is_released ? 'released' : 'unreleased'} successfully`, data: await content.setMaterialReleased(req.params.id, req.body.is_released) }); }
module.exports = { createAssessment, listAssessments, getAssessment, updateAssessment, release, unrelease, createQuestionPackage, getQuestionPackage, updateQuestion, updateOption, listUsers, getUser, listImages, createImage, getImage, deleteImage, listMaterials, createMaterial, getMaterial, getMaterialFile, deleteMaterial, setMaterialRelease, setMaterialUnrelease };
