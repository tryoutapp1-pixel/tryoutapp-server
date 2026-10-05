const pool = require('../config/database');
const ApiError = require('../utils/ApiError');

const QUESTION_CODES = ['TWK', 'TIU', 'TKP'];
const OPTION_CODES = ['A', 'B', 'C', 'D', 'E'];

async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const value = await work(connection);
    await connection.commit();
    return value;
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_NO_REFERENCED_ROW_2') throw new ApiError(400, 'An attachment or related record does not exist');
    throw error;
  } finally { connection.release(); }
}
function translateDuplicate(error) {
  if (error.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'Assessment already has a question package or the requested ordering is already used');
  throw error;
}
async function validateAttachments(executor, attachmentIds, imageIds) {
  const ids = [...new Set([...attachmentIds, ...imageIds].filter((id) => id != null))];
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await executor.execute(`SELECT id, mime_type FROM attachments WHERE id IN (${placeholders})`, ids);
  const attachments = new Map(rows.map((row) => [String(row.id), row]));
  for (const id of ids) if (!attachments.has(String(id))) throw new ApiError(400, 'An attachment does not exist');
  for (const id of imageIds.filter((value) => value != null)) {
    if (!attachments.get(String(id)).mime_type.toLowerCase().startsWith('image/')) throw new ApiError(400, 'Question and option attachments must be images');
  }
}

async function listAssessments({ page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const [items] = await pool.execute(
    `SELECT a.id, a.type, a.title, a.description, a.access_type, a.duration_minutes,
       a.passing_score_twk, a.passing_score_tiu, a.passing_score_tkp, a.is_released,
       a.created_at, a.updated_at, qp.id AS question_package_id, COUNT(DISTINCT q.id) AS question_count
     FROM assessments a
     LEFT JOIN question_packages qp ON qp.assessment_id = a.id
     LEFT JOIN questions q ON q.question_package_id = qp.id
     GROUP BY a.id, qp.id ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM assessments');
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getAssessment(id) {
  const [rows] = await pool.execute(
    `SELECT a.id, a.type, a.title, a.description, a.access_type, a.duration_minutes,
       a.passing_score_twk, a.passing_score_tiu, a.passing_score_tkp, a.is_released,
       a.created_at, a.updated_at, qp.id AS question_package_id, qp.created_at AS package_created_at,
       COUNT(DISTINCT q.id) AS question_count
     FROM assessments a LEFT JOIN question_packages qp ON qp.assessment_id = a.id
     LEFT JOIN questions q ON q.question_package_id = qp.id
     WHERE a.id = ? GROUP BY a.id, qp.id`, [id]);
  if (!rows[0]) throw new ApiError(404, 'Assessment not found');
  const row = rows[0];
  const questionPackage = row.question_package_id
    ? { id: row.question_package_id, created_at: row.package_created_at, question_count: row.question_count }
    : null;
  const { question_package_id, package_created_at, question_count, ...assessment } = row;
  return { ...assessment, question_package: questionPackage };
}

function validateAssessmentValues(data, current = {}) {
  const type = data.type ?? current.type;
  const duration = Object.prototype.hasOwnProperty.call(data, 'duration_minutes') ? data.duration_minutes : current.duration_minutes;
  if (!['TRYOUT', 'LATIHAN'].includes(type)) throw new ApiError(400, 'type must be TRYOUT or LATIHAN');
  if (type === 'TRYOUT' && (!Number.isInteger(Number(duration)) || Number(duration) <= 0)) {
    throw new ApiError(400, 'duration_minutes must be a positive integer for TRYOUT assessments');
  }
  if (type === 'LATIHAN' && duration != null) throw new ApiError(400, 'duration_minutes must be null for LATIHAN assessments');
}

async function createAssessment(data) {
  validateAssessmentValues(data);
  const [result] = await pool.execute(
    `INSERT INTO assessments (type, title, description, access_type, duration_minutes,
      passing_score_twk, passing_score_tiu, passing_score_tkp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.type, data.title, data.description ?? null, data.access_type ?? 'FREE', data.duration_minutes ?? null,
      data.passing_score_twk ?? 0, data.passing_score_tiu ?? 0, data.passing_score_tkp ?? 0]);
  return getAssessment(result.insertId);
}

async function updateAssessment(id, data) {
  const [[current]] = await pool.execute('SELECT type, duration_minutes FROM assessments WHERE id = ?', [id]);
  if (!current) throw new ApiError(404, 'Assessment not found');
  validateAssessmentValues(data, current);
  const allowed = ['type', 'title', 'description', 'access_type', 'duration_minutes', 'passing_score_twk', 'passing_score_tiu', 'passing_score_tkp'];
  const fields = Object.keys(data);
  if (!fields.length || fields.some((field) => !allowed.includes(field))) throw new ApiError(400, 'No editable assessment fields provided');
  await pool.execute(`UPDATE assessments SET ${fields.map((field) => `\`${field}\` = ?`).join(', ')} WHERE id = ?`, [...fields.map((field) => data[field]), id]);
  return getAssessment(id);
}

async function setReleased(id, released) {
  const [[assessment]] = await pool.execute('SELECT id FROM assessments WHERE id = ?', [id]);
  if (!assessment) throw new ApiError(404, 'Assessment not found');
  if (released) {
    const [[pkg]] = await pool.execute('SELECT id FROM question_packages WHERE assessment_id = ?', [id]);
    if (!pkg) throw new ApiError(409, 'Assessment must have a question package before release');
  }
  await pool.execute('UPDATE assessments SET is_released = ? WHERE id = ?', [released, id]);
  return getAssessment(id);
}

async function createQuestionPackage(assessmentId, questions) {
  try {
    return await transaction(async (connection) => {
      const [[assessment]] = await connection.execute('SELECT id, is_released FROM assessments WHERE id = ? FOR UPDATE', [assessmentId]);
      if (!assessment) throw new ApiError(404, 'Assessment not found');
      if (assessment.is_released) throw new ApiError(409, 'Unrelease the assessment before creating its question package');
      const [[existing]] = await connection.execute('SELECT id FROM question_packages WHERE assessment_id = ?', [assessmentId]);
      if (existing) throw new ApiError(409, 'Assessment already has a question package');

      const attachmentIds = [];
      const imageIds = [];
      for (const question of questions) {
        if (question.explanation_attachment_id != null) attachmentIds.push(question.explanation_attachment_id);
        if (question.image_attachment_id != null) imageIds.push(question.image_attachment_id);
        for (const option of question.options) if (option.image_attachment_id != null) imageIds.push(option.image_attachment_id);
      }
      await validateAttachments(connection, attachmentIds, imageIds);

      const [packageResult] = await connection.execute('INSERT INTO question_packages (assessment_id) VALUES (?)', [assessmentId]);
      const [typeRows] = await connection.execute('SELECT id, code FROM question_types WHERE code IN (?, ?, ?)', QUESTION_CODES);
      const typeIds = new Map(typeRows.map((row) => [row.code, row.id]));
      for (let qi = 0; qi < questions.length; qi += 1) {
        const question = questions[qi];
        const [questionResult] = await connection.execute(
          `INSERT INTO questions (question_package_id, question_type_id, question_number, question_text,
            explanation, image_attachment_id, explanation_attachment_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [packageResult.insertId, typeIds.get(question.question_type), qi + 1, question.question_text,
            question.explanation ?? null, question.image_attachment_id ?? null, question.explanation_attachment_id ?? null]);
        for (let oi = 0; oi < question.options.length; oi += 1) {
          const option = question.options[oi];
          await connection.execute(
            `INSERT INTO answer_options (question_id, option_code, option_text, option_order, score, image_attachment_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [questionResult.insertId, OPTION_CODES[oi], option.option_text, oi + 1, option.score, option.image_attachment_id ?? null]);
        }
      }
      return { id: packageResult.insertId, assessment_id: assessmentId, question_count: questions.length };
    });
  } catch (error) { translateDuplicate(error); }
}

async function getQuestionPackage(assessmentId) {
  const [[assessment]] = await pool.execute('SELECT id, type, title, is_released FROM assessments WHERE id = ?', [assessmentId]);
  if (!assessment) throw new ApiError(404, 'Assessment not found');
  const [[questionPackage]] = await pool.execute('SELECT id, assessment_id, created_at, updated_at FROM question_packages WHERE assessment_id = ?', [assessmentId]);
  if (!questionPackage) throw new ApiError(404, 'Question package not found');
  const [questions] = await pool.execute(
    `SELECT q.id, q.question_number, q.question_text, qt.code AS question_type, q.explanation,
       q.image_attachment_id, qi.file_url AS question_image_url,
       q.explanation_attachment_id, ei.file_url AS explanation_file_url
     FROM questions q JOIN question_types qt ON qt.id = q.question_type_id
     LEFT JOIN attachments qi ON qi.id = q.image_attachment_id
     LEFT JOIN attachments ei ON ei.id = q.explanation_attachment_id
     WHERE q.question_package_id = ? ORDER BY q.question_number ASC`, [questionPackage.id]);
  const [options] = await pool.execute(
    `SELECT ao.id, ao.question_id, ao.option_code, ao.option_text, ao.option_order, ao.score,
       ao.image_attachment_id, a.file_url AS option_image_url
     FROM answer_options ao LEFT JOIN attachments a ON a.id = ao.image_attachment_id
     JOIN questions q ON q.id = ao.question_id
     WHERE q.question_package_id = ? ORDER BY q.question_number ASC, ao.option_order ASC`, [questionPackage.id]);
  const optionsByQuestion = new Map();
  for (const option of options) {
    if (!optionsByQuestion.has(option.question_id)) optionsByQuestion.set(option.question_id, []);
    optionsByQuestion.get(option.question_id).push(option);
  }
  return { assessment, ...questionPackage, questions: questions.map((question) => ({ ...question, options: optionsByQuestion.get(question.id) || [] })) };
}

async function updateQuestion(id, data) {
  const allowed = ['question_text', 'question_type', 'explanation', 'image_attachment_id', 'explanation_attachment_id'];
  const fields = Object.keys(data);
  if (!fields.length || fields.some((field) => !allowed.includes(field))) throw new ApiError(400, 'No editable question fields provided');
  return transaction(async (connection) => {
    const [[question]] = await connection.execute('SELECT id FROM questions WHERE id = ? FOR UPDATE', [id]);
    if (!question) throw new ApiError(404, 'Question not found');
    await validateAttachments(connection,
      Object.prototype.hasOwnProperty.call(data, 'explanation_attachment_id') ? [data.explanation_attachment_id] : [],
      Object.prototype.hasOwnProperty.call(data, 'image_attachment_id') ? [data.image_attachment_id] : []);
    const values = { ...data };
    if (Object.prototype.hasOwnProperty.call(values, 'question_type')) {
      const [[type]] = await connection.execute('SELECT id FROM question_types WHERE code = ?', [values.question_type]);
      if (!type) throw new ApiError(400, 'question_type must be TWK, TIU, or TKP');
      values.question_type_id = type.id;
      delete values.question_type;
    }
    const updateFields = Object.keys(values);
    await connection.execute(`UPDATE questions SET ${updateFields.map((field) => `\`${field}\` = ?`).join(', ')} WHERE id = ?`, [...updateFields.map((field) => values[field]), id]);
    const [[updated]] = await connection.execute(
      `SELECT q.id, q.question_number, q.question_text, qt.code AS question_type, q.explanation,
        q.image_attachment_id, q.explanation_attachment_id FROM questions q
       JOIN question_types qt ON qt.id = q.question_type_id WHERE q.id = ?`, [id]);
    return updated;
  });
}

async function updateOption(questionId, optionId, data) {
  return transaction(async (connection) => {
    const [[option]] = await connection.execute('SELECT id, option_order FROM answer_options WHERE id = ? AND question_id = ? FOR UPDATE', [optionId, questionId]);
    if (!option) throw new ApiError(404, 'Option not found for this question');
    const fields = Object.keys(data);
    const allowed = ['option_text', 'score', 'image_attachment_id', 'option_order'];
    if (!fields.length || fields.some((field) => !allowed.includes(field))) throw new ApiError(400, 'No editable option fields provided');
    if (Object.prototype.hasOwnProperty.call(data, 'image_attachment_id')) await validateAttachments(connection, [], [data.image_attachment_id]);
    if (Object.prototype.hasOwnProperty.call(data, 'option_order')) {
      if (data.option_order < 1 || data.option_order > 4) throw new ApiError(400, 'option_order must be between 1 and 4');
      data.option_code = OPTION_CODES[data.option_order - 1];
    }
    const updateFields = Object.keys(data);
    try {
      await connection.execute(`UPDATE answer_options SET ${updateFields.map((field) => `\`${field}\` = ?`).join(', ')} WHERE id = ? AND question_id = ?`, [...updateFields.map((field) => data[field]), optionId, questionId]);
    } catch (error) { translateDuplicate(error); }
    const [[updated]] = await connection.execute('SELECT * FROM answer_options WHERE id = ?', [optionId]);
    return updated;
  });
}

module.exports = { listAssessments, getAssessment, createAssessment, updateAssessment, setReleased, createQuestionPackage, getQuestionPackage, updateQuestion, updateOption };
