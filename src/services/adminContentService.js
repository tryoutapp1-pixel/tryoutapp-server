const pool = require('../config/database');
const storage = require('./fileStorageService');
const ApiError = require('../utils/ApiError');
const { toPageArgs, toPageResult } = require('../utils/pagination');
const { withTransaction } = require('../utils/transaction');

const SIGNED_URL_TTL_SECONDS = 60;
const MATERIAL_EDITABLE_FIELDS = ['title', 'description', 'type', 'access_type'];
const MATERIAL_COLUMNS = 'm.id, m.title, m.description, m.type, m.access_type, m.is_released, m.created_at, m.updated_at';
const USER_COLUMNS = `u.id, u.name, u.email, u.role, u.status, u.email_verified_at, u.created_at, u.updated_at,
  s.status AS subscription_status, s.started_at AS subscription_started_at, s.expired_at AS subscription_expired_at`;

/** @typedef {{ page?: number, limit?: number }} PageQuery */

/**
 * Logs a failed R2 cleanup without masking the original error.
 *
 * @param {string} objectKey
 * @param {string} context
 * @param {Error} error
 */
function logCleanupFailure(objectKey, context, error) {
  console.error(`R2 cleanup failed after ${context}`, { object_key: objectKey, operation: 'delete', error_message: error.message });
}

/** @param {Record<string, any>} row - attachments row */
function attachmentView(row) {
  return {
    id: row.id,
    original_filename: row.original_name,
    mime_type: row.mime_type,
    size: row.file_size,
    created_at: row.created_at,
    url: `/api/admin/images/${row.id}`
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** @param {PageQuery} query */
async function listUsers(query) {
  const { page, limit, offset } = toPageArgs(query);
  const [items] = await pool.execute(
    `SELECT ${USER_COLUMNS}
     FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id
     ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM users');
  return toPageResult(items, page, limit, total);
}

/** @param {number} id */
async function getUser(id) {
  const [[user]] = await pool.execute(
    `SELECT ${USER_COLUMNS} FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id WHERE u.id = ?`,
    [id]
  );
  if (!user) throw new ApiError(404, 'User not found');
  return user;
}

/**
 * Reversible account suspension: true sets SUSPENDED, false sets ACTIVE.
 * Only USER accounts can be suspended. Admins and unverified accounts are left
 * alone so administration and the verify flow keep working.
 *
 * @param {number} id
 * @param {boolean} suspend
 */
async function setUserSuspended(id, suspend) {
  const [[user]] = await pool.execute('SELECT id, role, status FROM users WHERE id = ?', [id]);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role !== 'USER') throw new ApiError(400, 'Only USER accounts can be suspended');
  if (suspend && user.status === 'PENDING_VERIFICATION') {
    throw new ApiError(409, 'Cannot suspend an account that has not verified its email');
  }
  if (!suspend && user.status !== 'SUSPENDED') throw new ApiError(409, 'Account is not suspended');

  await pool.execute('UPDATE users SET status = ? WHERE id = ?', [suspend ? 'SUSPENDED' : 'ACTIVE', id]);
  return getUser(id);
}

// ---------------------------------------------------------------------------
// Images and attachments
// ---------------------------------------------------------------------------

/** @param {PageQuery} query */
async function listImages(query) {
  const { page, limit, offset } = toPageArgs(query);
  const [rows] = await pool.execute(
    "SELECT * FROM attachments WHERE mime_type LIKE 'image/%' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
    [limit, offset]
  );
  const [[{ total }]] = await pool.execute("SELECT COUNT(*) AS total FROM attachments WHERE mime_type LIKE 'image/%'");
  const items = await Promise.all(rows.map(async (row) => ({
    ...attachmentView(row),
    url: row.object_key ? await storage.getSignedUrl(row.object_key, SIGNED_URL_TTL_SECONDS) : null
  })));
  return toPageResult(items, page, limit, total);
}

/**
 * Uploads a file to R2 and records its metadata. Removes the R2 object again
 * when the insert fails.
 *
 * @param {Express.Multer.File} file
 * @param {'image'|'material'} category
 */
async function createAttachment(file, category) {
  const saved = await storage.save(file, category);
  try {
    const [result] = await pool.execute(
      `INSERT INTO attachments (file_name, original_name, file_path, object_key, file_url, mime_type, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [saved.storedName, String(file.originalname || 'upload').slice(0, 255), saved.objectKey, saved.objectKey, null, file.mimetype, file.size]
    );
    const [[row]] = await pool.execute('SELECT * FROM attachments WHERE id = ?', [result.insertId]);
    return row;
  } catch (error) {
    try {
      await storage.remove(saved.objectKey);
    } catch (cleanupError) {
      logCleanupFailure(saved.objectKey, 'attachment metadata insert failure', cleanupError);
    }
    throw error;
  }
}

/** @param {Express.Multer.File} file */
async function createImage(file) {
  return attachmentView(await createAttachment(file, 'image'));
}

/** @param {number} id */
async function getImage(id) {
  const [[row]] = await pool.execute("SELECT * FROM attachments WHERE id = ? AND mime_type LIKE 'image/%'", [id]);
  if (!row) throw new ApiError(404, 'Image not found');
  return row;
}

/**
 * Deletes an image that no question, option, explanation or material uses.
 *
 * @param {number} id
 */
async function deleteImage(id) {
  await withTransaction(async (connection) => {
    const [[row]] = await connection.execute(
      "SELECT * FROM attachments WHERE id = ? AND mime_type LIKE 'image/%' FOR UPDATE",
      [id]
    );
    if (!row) throw new ApiError(404, 'Image not found');

    const [[refs]] = await connection.execute(
      `SELECT (SELECT COUNT(*) FROM questions WHERE image_attachment_id = ?)
        + (SELECT COUNT(*) FROM answer_options WHERE image_attachment_id = ?)
        + (SELECT COUNT(*) FROM questions WHERE explanation_attachment_id = ?)
        + (SELECT COUNT(*) FROM materials WHERE attachment_id = ?) AS total`,
      [id, id, id, id]
    );
    if (Number(refs.total)) throw new ApiError(409, 'Image is referenced by a question, option, explanation, or material');

    await storage.remove(row.object_key, 'image');
    await connection.execute('DELETE FROM attachments WHERE id = ?', [id]);
  });
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/** @param {PageQuery} query */
async function listMaterials(query) {
  const { page, limit, offset } = toPageArgs(query);
  const [items] = await pool.execute(
    `SELECT ${MATERIAL_COLUMNS} FROM materials m ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM materials');
  return toPageResult(items, page, limit, total);
}

/** @param {Record<string, any>} row - materials row joined with its attachment */
async function materialView(row) {
  const { attachment_id, original_name, mime_type, file_size, file_created_at, object_key, ...material } = row;
  return {
    ...material,
    file: {
      id: attachment_id,
      original_filename: original_name,
      mime_type,
      size: file_size,
      created_at: file_created_at,
      url: object_key ? await storage.getSignedUrl(object_key, SIGNED_URL_TTL_SECONDS) : null
    }
  };
}

/** @param {number} id */
async function getMaterial(id) {
  const [[row]] = await pool.execute(
    `SELECT ${MATERIAL_COLUMNS},
       a.id AS attachment_id, a.original_name, a.mime_type, a.file_size, a.object_key, a.created_at AS file_created_at
     FROM materials m JOIN attachments a ON a.id = m.attachment_id
     WHERE m.id = ?`,
    [id]
  );
  if (!row) throw new ApiError(404, 'Material not found');
  return materialView(row);
}

/**
 * @param {{ title: string, description?: string|null, type: 'TWK'|'TIU'|'TKP', access_type?: 'FREE'|'PREMIUM' }} data
 * @param {Express.Multer.File} file - PDF upload
 */
async function createMaterial(data, file) {
  const attachment = await createAttachment(file, 'material');
  try {
    const [result] = await pool.execute(
      'INSERT INTO materials (title, description, type, access_type, attachment_id) VALUES (?, ?, ?, ?, ?)',
      [data.title, data.description ?? null, data.type, data.access_type || 'FREE', attachment.id]
    );
    return getMaterial(result.insertId);
  } catch (error) {
    try {
      await storage.remove(attachment.object_key, 'material');
    } catch (cleanupError) {
      logCleanupFailure(attachment.object_key, 'material insert failure', cleanupError);
    }
    await pool.execute('DELETE FROM attachments WHERE id = ?', [attachment.id]);
    throw error;
  }
}

/**
 * Updates material metadata. The file itself cannot be replaced here.
 *
 * @param {number} id
 * @param {Partial<{ title: string, description: string|null, type: string, access_type: string }>} data
 */
async function updateMaterial(id, data) {
  const fields = MATERIAL_EDITABLE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(data, field));
  if (!fields.length) throw new ApiError(400, 'No editable material fields provided');

  const [result] = await pool.execute(
    `UPDATE materials SET ${fields.map((field) => `\`${field}\` = ?`).join(', ')} WHERE id = ?`,
    [...fields.map((field) => data[field] ?? null), id]
  );
  if (!result.affectedRows) throw new ApiError(404, 'Material not found');
  return getMaterial(id);
}

/** @param {number} id */
async function getMaterialFile(id) {
  const [[row]] = await pool.execute('SELECT a.* FROM materials m JOIN attachments a ON a.id = m.attachment_id WHERE m.id = ?', [id]);
  if (!row) throw new ApiError(404, 'Material not found');
  return row;
}

/**
 * Deletes a material. Its attachment is removed too unless another material
 * shares it; attachments used by questions block the delete.
 *
 * @param {number} id
 */
async function deleteMaterial(id) {
  await withTransaction(async (connection) => {
    const [[row]] = await connection.execute(
      'SELECT m.attachment_id, a.object_key FROM materials m JOIN attachments a ON a.id = m.attachment_id WHERE m.id = ? FOR UPDATE',
      [id]
    );
    if (!row) throw new ApiError(404, 'Material not found');

    const [[refs]] = await connection.execute(
      `SELECT (SELECT COUNT(*) FROM questions WHERE image_attachment_id = ?)
        + (SELECT COUNT(*) FROM answer_options WHERE image_attachment_id = ?)
        + (SELECT COUNT(*) FROM questions WHERE explanation_attachment_id = ?) AS total`,
      [row.attachment_id, row.attachment_id, row.attachment_id]
    );
    if (Number(refs.total)) throw new ApiError(409, 'Material attachment is referenced by a question, option, or explanation');

    const [[shared]] = await connection.execute(
      'SELECT COUNT(*) AS total FROM materials WHERE attachment_id = ? AND id <> ?',
      [row.attachment_id, id]
    );
    await connection.execute('DELETE FROM materials WHERE id = ?', [id]);
    if (Number(shared.total)) return;

    await storage.remove(row.object_key, 'material');
    await connection.execute('DELETE FROM attachments WHERE id = ?', [row.attachment_id]);
  });
}

/**
 * @param {number} id
 * @param {boolean} released
 */
async function setMaterialReleased(id, released) {
  const [[material]] = await pool.execute(`SELECT ${MATERIAL_COLUMNS} FROM materials m WHERE m.id = ?`, [id]);
  if (!material) throw new ApiError(404, 'Material not found');
  await pool.execute('UPDATE materials SET is_released = ? WHERE id = ?', [released, id]);
  return { ...material, is_released: released ? 1 : 0 };
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

/**
 * Lists user feedback, newest first, with optional filters. `summary` covers
 * every row that matches the filters, not just the current page.
 *
 * @param {PageQuery & { assessment_id?: number, assessment_type?: 'LATIHAN'|'TRYOUT', rating?: number, difficulty?: 'EASY'|'MEDIUM'|'HARD' }} query
 */
async function listFeedback(query) {
  const { page, limit, offset } = toPageArgs(query);
  const conditions = [];
  const params = [];
  if (query.assessment_id) {
    conditions.push('f.assessment_id = ?');
    params.push(query.assessment_id);
  }
  if (query.assessment_type) {
    conditions.push('a.type = ?');
    params.push(query.assessment_type);
  }
  if (query.rating) {
    conditions.push('f.rating = ?');
    params.push(query.rating);
  }
  if (query.difficulty) {
    conditions.push('f.difficulty = ?');
    params.push(query.difficulty);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const from = 'FROM feedbacks f JOIN assessments a ON a.id = f.assessment_id JOIN users u ON u.id = f.user_id';

  const [items] = await pool.execute(
    `SELECT f.id, f.rating, f.difficulty, f.comment, f.created_at,
       a.id AS assessment_id, a.title AS assessment_title, a.type AS assessment_type,
       u.id AS user_id, u.name AS user_name, u.email AS user_email
     ${from} ${where}
     ORDER BY f.created_at DESC, f.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[summary]] = await pool.execute(`SELECT COUNT(*) AS total, AVG(f.rating) AS average_rating ${from} ${where}`, params);

  return {
    ...toPageResult(items, page, limit, summary.total),
    summary: {
      total: Number(summary.total),
      average_rating: summary.average_rating === null ? null : Number(Number(summary.average_rating).toFixed(2))
    }
  };
}

module.exports = {
  listUsers,
  getUser,
  setUserSuspended,
  listImages,
  createImage,
  getImage,
  deleteImage,
  listMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  getMaterialFile,
  deleteMaterial,
  setMaterialReleased,
  listFeedback
};
