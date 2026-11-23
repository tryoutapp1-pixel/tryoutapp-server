const crypto = require('node:crypto');
const { env } = require('../config/env');
const r2 = require('./r2Service');
const ApiError = require('../utils/ApiError');

/** @typedef {'image'|'material'} FileCategory */

const IMAGE_TYPES = new Map([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/gif', '.gif']]);
const MATERIAL_TYPES = new Map([['application/pdf', '.pdf']]);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Checks the declared MIME type, the size, and the file's magic bytes.
 *
 * @param {Express.Multer.File} file
 * @param {FileCategory} category
 * @returns {string} File extension for the stored object
 */
function validate(file, category) {
  if (!file || !Buffer.isBuffer(file.buffer)) throw new ApiError(400, 'File is required');
  const types = category === 'image' ? IMAGE_TYPES : MATERIAL_TYPES;
  const extension = types.get(file.mimetype);
  if (!extension) throw new ApiError(415, `Unsupported ${category} MIME type`);
  const max = category === 'image' ? env.maxImageSize : env.maxMaterialSize;
  if (file.size > max) throw new ApiError(413, 'Uploaded file is too large');

  const bytes = file.buffer;
  const signatures = {
    'image/jpeg': bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    'image/png': bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE),
    'image/gif': bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString()),
    'image/webp': bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP',
    'application/pdf': bytes.subarray(0, 5).toString() === '%PDF-'
  };
  if (!signatures[file.mimetype]) throw new ApiError(415, 'File content does not match its MIME type');
  return extension;
}

/**
 * @param {Express.Multer.File} file
 * @param {FileCategory} category
 * @returns {Promise<{ objectKey: string, storedName: string }>}
 */
async function save(file, category) {
  const extension = validate(file, category);
  const prefix = category === 'image' ? 'images' : 'materials';
  const key = `${prefix}/${crypto.randomUUID()}${extension}`;
  try {
    await r2.upload({ key, body: file.buffer, contentType: file.mimetype });
  } catch (error) {
    console.error('R2 operation failed', { operation: 'upload', object_key: key, entity: category, error_code: error.Code || error.code, error_message: error.message });
    throw new ApiError(502, 'File storage upload failed');
  }
  return { objectKey: key, storedName: `${crypto.randomUUID()}${extension}` };
}

/**
 * @param {string} objectKey
 * @param {string} [entity='attachment'] - For log context only
 */
async function remove(objectKey, entity = 'attachment') {
  try {
    await r2.remove({ key: objectKey });
  } catch (error) {
    console.error('R2 operation failed', { operation: 'delete', object_key: objectKey, entity, error_code: error.Code || error.code, error_message: error.message });
    throw new ApiError(502, 'File storage deletion failed');
  }
}

/**
 * @param {string} objectKey
 * @param {number} [expiresIn=60] - Seconds
 * @returns {Promise<string>}
 */
async function getSignedUrl(objectKey, expiresIn = 60) {
  if (!objectKey) throw new ApiError(404, 'File is not available in R2 storage');
  try {
    return await r2.getSignedUrl({ key: objectKey, expiresIn });
  } catch (error) {
    console.error('R2 operation failed', { operation: 'get_signed_url', object_key: objectKey, error_code: error.Code || error.code, error_message: error.message });
    throw new ApiError(500, 'Could not generate file access URL');
  }
}

module.exports = { save, remove, getSignedUrl, IMAGE_TYPES, MATERIAL_TYPES };
