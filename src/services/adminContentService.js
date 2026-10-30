const pool = require('../config/database');
const storage = require('./fileStorageService');
const ApiError = require('../utils/ApiError');

const pageArgs = ({ page = 1, limit = 20 }) => ({ page: Number(page), limit: Number(limit), offset: (Number(page) - 1) * Number(limit) });
const paginated = (items, page, limit, total) => ({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
function attachmentView(row) { return { id: row.id, original_filename: row.original_name, mime_type: row.mime_type, size: row.file_size, created_at: row.created_at, url: `/api/admin/images/${row.id}` }; }
async function listUsers(args) {
  const { page, limit, offset } = pageArgs(args);

  const [items] = await pool.execute(
    `SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.email_verified_at,
        u.created_at,
        u.updated_at,
        s.status AS subscription_status,
        s.started_at AS subscription_started_at,
        s.expired_at AS subscription_expired_at
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const [[{ total }]] = await pool.execute(
    'SELECT COUNT(*) AS total FROM users'
  );

  return paginated(items, page, limit, total);
}
async function getUser(id) {
  const [[user]] = await pool.execute(
    `SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.email_verified_at,
        u.created_at,
        u.updated_at,
        s.status AS subscription_status,
        s.started_at AS subscription_started_at,
        s.expired_at AS subscription_expired_at
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE u.id = ?`,
    [id]
  );

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
}
// Reversible account suspension. suspend=true -> SUSPENDED, false -> ACTIVE.
// Only USER accounts can be suspended; admins and not-yet-verified accounts are
// left alone to avoid locking out administration or breaking the verify flow.
async function setUserSuspended(id, suspend) {
  const [[user]] = await pool.execute('SELECT id, role, status FROM users WHERE id = ?', [id]);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role !== 'USER') throw new ApiError(400, 'Only USER accounts can be suspended');
  if (suspend) {
    if (user.status === 'PENDING_VERIFICATION') throw new ApiError(409, 'Cannot suspend an account that has not verified its email');
  } else if (user.status !== 'SUSPENDED') {
    throw new ApiError(409, 'Account is not suspended');
  }
  await pool.execute('UPDATE users SET status = ? WHERE id = ?', [suspend ? 'SUSPENDED' : 'ACTIVE', id]);
  return getUser(id);
}
async function listImages(args) {
  const { page, limit, offset } = pageArgs(args);
  const [rows] = await pool.execute("SELECT * FROM attachments WHERE mime_type LIKE 'image/%' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?", [limit, offset]);
  const [[{ total }]] = await pool.execute("SELECT COUNT(*) AS total FROM attachments WHERE mime_type LIKE 'image/%'");
  const items = await Promise.all(rows.map(async (row) => ({
    ...attachmentView(row),
    url: row.object_key ? await storage.getSignedUrl(row.object_key, 60) : null
  })));
  return paginated(items, page, limit, total);
}
async function createAttachment(file, category) {
  const saved = await storage.save(file, category);
  try {
    const [result] = await pool.execute('INSERT INTO attachments (file_name, original_name, file_path, object_key, file_url, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)', [saved.storedName, String(file.originalname || 'upload').slice(0, 255), saved.objectKey, saved.objectKey, null, file.mimetype, file.size]);
    const [[row]] = await pool.execute('SELECT * FROM attachments WHERE id = ?', [result.insertId]); return row;
  } catch (error) {
    try { await storage.remove(saved.objectKey); }
    catch (cleanupError) { console.error('R2 cleanup failed after attachment metadata insert failure', { object_key: saved.objectKey, operation: 'delete', error_message: cleanupError.message }); }
    throw error;
  }
}
async function createImage(file) { return attachmentView(await createAttachment(file, 'image')); }
async function getImage(id) {
  const [[row]] = await pool.execute("SELECT * FROM attachments WHERE id = ? AND mime_type LIKE 'image/%'", [id]);
  if (!row) throw new ApiError(404, 'Image not found'); return row;
}
async function deleteImage(id) {
  const connection = await pool.getConnection(); let objectKey;
  try {
    await connection.beginTransaction();
    const [[row]] = await connection.execute("SELECT * FROM attachments WHERE id = ? AND mime_type LIKE 'image/%' FOR UPDATE", [id]);
    if (!row) throw new ApiError(404, 'Image not found'); objectKey = row.object_key;
    const [[refs]] = await connection.execute('SELECT (SELECT COUNT(*) FROM questions WHERE image_attachment_id = ?) + (SELECT COUNT(*) FROM answer_options WHERE image_attachment_id = ?) + (SELECT COUNT(*) FROM questions WHERE explanation_attachment_id = ?) + (SELECT COUNT(*) FROM materials WHERE attachment_id = ?) AS total', [id, id, id, id]);
    if (refs.total) throw new ApiError(409, 'Image is referenced by a question, option, explanation, or material');
    await storage.remove(objectKey, 'image');
    await connection.execute('DELETE FROM attachments WHERE id = ?', [id]); await connection.commit();
  } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
}
async function listMaterials(args) {
  const { page, limit, offset } = pageArgs(args);
  const [items] = await pool.execute('SELECT id, title, description, access_type, is_released, created_at, updated_at FROM materials ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?', [limit, offset]);
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM materials');
  return paginated(items, page, limit, total);
}
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
      url: object_key ? await storage.getSignedUrl(object_key, 60) : null
    }
  };
}
async function getMaterial(id) {
  const [[row]] = await pool.execute('SELECT m.id, m.title, m.description, m.access_type, m.is_released, m.created_at, m.updated_at, a.id AS attachment_id, a.original_name, a.mime_type, a.file_size, a.object_key, a.created_at AS file_created_at FROM materials m JOIN attachments a ON a.id = m.attachment_id WHERE m.id = ?', [id]);
  if (!row) throw new ApiError(404, 'Material not found'); return materialView(row);
}
async function createMaterial(data, file) {
  const attachment = await createAttachment(file, 'material');
  try {
    const [result] = await pool.execute('INSERT INTO materials (title, description, access_type, attachment_id) VALUES (?, ?, ?, ?)', [data.title, data.description ?? null, data.access_type || 'FREE', attachment.id]);
    return getMaterial(result.insertId);
  } catch (error) {
    try { await storage.remove(attachment.object_key, 'material'); }
    catch (cleanupError) { console.error('R2 cleanup failed after material insert failure', { object_key: attachment.object_key, operation: 'delete', error_message: cleanupError.message }); }
    await pool.execute('DELETE FROM attachments WHERE id = ?', [attachment.id]); throw error;
  }
}
async function getMaterialFile(id) {
  const [[row]] = await pool.execute('SELECT a.* FROM materials m JOIN attachments a ON a.id = m.attachment_id WHERE m.id = ?', [id]);
  if (!row) throw new ApiError(404, 'Material not found'); return row;
}
async function deleteMaterial(id) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[row]] = await connection.execute('SELECT m.attachment_id, a.object_key FROM materials m JOIN attachments a ON a.id = m.attachment_id WHERE m.id = ? FOR UPDATE', [id]);
    if (!row) throw new ApiError(404, 'Material not found');
    const [[refs]] = await connection.execute('SELECT (SELECT COUNT(*) FROM questions WHERE image_attachment_id = ?) + (SELECT COUNT(*) FROM answer_options WHERE image_attachment_id = ?) + (SELECT COUNT(*) FROM questions WHERE explanation_attachment_id = ?) AS total', [row.attachment_id, row.attachment_id, row.attachment_id]);
    if (refs.total) throw new ApiError(409, 'Material attachment is referenced by a question, option, or explanation');
    const [[otherMaterials]] = await connection.execute('SELECT COUNT(*) AS total FROM materials WHERE attachment_id = ? AND id <> ?', [row.attachment_id, id]);
    if (otherMaterials.total) {
      await connection.execute('DELETE FROM materials WHERE id = ?', [id]);
      await connection.commit();
      return;
    }
    await storage.remove(row.object_key, 'material');
    await connection.execute('DELETE FROM materials WHERE id = ?', [id]); await connection.execute('DELETE FROM attachments WHERE id = ?', [row.attachment_id]); await connection.commit();
  } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
}
async function setMaterialReleased(id, released) {
  const [[material]] = await pool.execute('SELECT id, title, description, access_type, is_released, created_at, updated_at FROM materials WHERE id = ?', [id]);
  if (!material) throw new ApiError(404, 'Material not found');
  await pool.execute('UPDATE materials SET is_released = ? WHERE id = ?', [released, id]);
  return material;
  
  // const [result] = await pool.execute('UPDATE materials SET is_released = ? WHERE id = ?', [released, id]);
  // if (!result.affectedRows) throw new ApiError(404, 'Material not found'); return getMaterial(id);
}
module.exports = { listUsers, getUser, setUserSuspended, listImages, createImage, getImage, deleteImage, listMaterials, getMaterial, createMaterial, getMaterialFile, deleteMaterial, setMaterialReleased };
