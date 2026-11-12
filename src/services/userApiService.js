const crypto = require('node:crypto');
const midtrans = require('midtrans-client');
const pool = require('../config/database');
const { env } = require('../config/env');
const storage = require('./fileStorageService');
const ApiError = require('../utils/ApiError');
const { toPageArgs, toPageResult } = require('../utils/pagination');
const { withTransaction } = require('../utils/transaction');

/** @typedef {'LATIHAN'|'TRYOUT'} AssessmentType */
/** @typedef {'FREE'|'PREMIUM'} AccessType */
/** @typedef {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} Executor */

const SIGNED_URL_TTL_SECONDS = 60;
const FINALIZED_STATUSES = "('COMPLETED','EXPIRED')";
/** Question types that have a single correct option. TKP uses graded scores instead. */
const SINGLE_ANSWER_TYPES = new Set(['TWK', 'TIU']);

const snap = new midtrans.Snap({
  isProduction: env.midtrans.isProduction,
  serverKey: env.midtrans.serverKey,
  clientKey: env.midtrans.clientKey
});

/** @param {string|null|undefined} objectKey */
async function signedUrl(objectKey) {
  return objectKey ? storage.getSignedUrl(objectKey, SIGNED_URL_TTL_SECONDS) : null;
}

// ---------------------------------------------------------------------------
// Subscription and access
// ---------------------------------------------------------------------------

/**
 * Loads the user's subscription row and derives the effective status. A
 * PREMIUM row whose expiry has passed counts as FREE.
 *
 * @param {Executor} executor
 * @param {number} userId
 * @param {boolean} [lock=false] - Adds FOR UPDATE to serialize concurrent writers.
 */
async function loadSubscription(executor, userId, lock = false) {
  const [[row]] = await executor.execute(
    `SELECT * FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [userId]
  );
  if (!row) throw new ApiError(409, 'Subscription record is missing');
  const premium = row.status === 'PREMIUM' && row.expired_at && new Date(row.expired_at) > new Date();
  return { ...row, effectiveStatus: premium ? 'PREMIUM' : 'FREE' };
}

/**
 * @param {Executor} executor
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function isPremium(executor, userId) {
  return (await loadSubscription(executor, userId)).effectiveStatus === 'PREMIUM';
}

/**
 * Throws 403 when `accessType` is PREMIUM and the user is not Premium.
 *
 * @param {Executor} executor
 * @param {number} userId
 * @param {AccessType} accessType
 */
async function checkAccess(executor, userId, accessType) {
  if (accessType === 'PREMIUM' && !(await isPremium(executor, userId))) {
    throw new ApiError(403, 'Premium subscription is required');
  }
}

async function offer() {
  return [
    {
      name: 'Free',
      title: 'Tryout App Free',
      price: 0,
      currency: 'IDR',
      duration_days: 999,
      duration_description: 'Selamanya'
    },
    {
      name: 'Premium',
      title: 'Tryout App Premium',
      price: env.premiumPrice,
      currency: 'IDR',
      duration_days: env.premiumDurationDays,
      duration_description: `${env.premiumDurationDays} hari`
    }
  ];
}

/** @param {number} userId */
async function getSubscription(userId) {
  const subscription = await loadSubscription(pool, userId);
  return {
    status: subscription.effectiveStatus,
    started_at: subscription.started_at,
    expired_at: subscription.expired_at
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

const MIDTRANS_TERMINAL_STATUS = { expire: 'EXPIRED', cancel: 'CANCELLED', deny: 'FAILED', failure: 'FAILED' };
const MIDTRANS_STATUS_MAP = {
  pending: 'PENDING',
  deny: 'FAILED',
  cancel: 'CANCELLED',
  expire: 'EXPIRED',
  failure: 'FAILED',
  refund: 'PAID',
  partial_refund: 'PAID'
};

/**
 * Creates a Snap payment, or resumes the user's latest PENDING one when
 * Midtrans still reports it as pending.
 *
 * @param {number} userId
 */
async function createPayment(userId) {
  if (!env.midtrans.serverKey || !env.midtrans.clientKey) throw new ApiError(503, 'Midtrans is not configured');

  return withTransaction(async (connection) => {
    // Locking the subscription row serializes concurrent payment creation per user.
    await loadSubscription(connection, userId, true);

    const [[existing]] = await connection.execute(
      "SELECT * FROM transactions WHERE user_id = ? AND status = 'PENDING' ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
      [userId]
    );
    if (existing) {
      const resumed = await resumePendingPayment(connection, existing);
      if (resumed) return resumed;
    }

    const orderId = `PREM-${userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const [result] = await connection.execute(
      "INSERT INTO transactions (user_id, order_id, amount, status) VALUES (?, ?, ?, 'PENDING')",
      [userId, orderId, env.premiumPrice]
    );
    const token = await snap.createTransaction({
      transaction_details: { order_id: orderId, gross_amount: env.premiumPrice },
      credit_card: { secure: true }
    });
    await connection.execute('UPDATE transactions SET snap_token = ? WHERE id = ?', [token.token, result.insertId]);

    return {
      order_id: orderId,
      transaction_id: result.insertId,
      snap_token: token.token,
      amount: env.premiumPrice,
      currency: 'IDR',
      status: 'PENDING'
    };
  });
}

/**
 * Returns the resumable payment for a local PENDING transaction, or null after
 * marking it terminal so the caller can create a new one.
 *
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {Record<string, any>} existing
 */
async function resumePendingPayment(connection, existing) {
  try {
    const remote = await snap.transaction.status(existing.order_id);
    if (remote.transaction_status === 'pending') {
      let snapToken = existing.snap_token;
      if (!snapToken) {
        const token = await snap.createTransaction({
          transaction_details: { order_id: existing.order_id, gross_amount: Number(existing.amount) }
        });
        snapToken = token.token;
        await connection.execute('UPDATE transactions SET snap_token = ? WHERE id = ?', [snapToken, existing.id]);
      }
      return {
        order_id: existing.order_id,
        transaction_id: existing.id,
        snap_token: snapToken,
        amount: Number(existing.amount),
        currency: 'IDR',
        status: existing.status
      };
    }

    const terminal = MIDTRANS_TERMINAL_STATUS[remote.transaction_status];
    if (!terminal) throw new ApiError(409, 'Existing payment is awaiting Midtrans confirmation');
    await connection.execute(
      "UPDATE transactions SET status = ?, midtrans_transaction_status = ? WHERE id = ? AND status = 'PENDING'",
      [terminal, remote.transaction_status, existing.id]
    );
  } catch (error) {
    // Midtrans returns 404 when it never saw the order; treat it as expired.
    if (error.statusCode !== 404 && error.httpStatusCode !== 404) throw error;
    await connection.execute("UPDATE transactions SET status = 'EXPIRED' WHERE id = ? AND status = 'PENDING'", [existing.id]);
  }
  return null;
}

/**
 * @param {number} userId
 * @param {{ page?: number, limit?: number }} query
 */
async function transactionHistory(userId, query) {
  const { page, limit, offset } = toPageArgs(query);
  const [items] = await pool.execute(
    `SELECT order_id, amount, status, payment_method, created_at, updated_at
     FROM transactions WHERE user_id = ?
     ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM transactions WHERE user_id = ?', [userId]);
  return toPageResult(items, page, limit, total);
}

/**
 * Handles the Midtrans HTTP notification. Verifies the SHA-512 signature and
 * the amount, updates the transaction, and activates or extends Premium once.
 *
 * @param {Record<string, any>} body
 */
async function midtransNotification(body) {
  const {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: signature,
    transaction_status: remoteStatus,
    fraud_status: fraudStatus
  } = body || {};

  const required = [orderId, statusCode, grossAmount, remoteStatus];
  if (!required.every((value) => typeof value === 'string' && value.length)) {
    throw new ApiError(400, 'Invalid Midtrans notification payload');
  }
  if (!env.midtrans.serverKey) throw new ApiError(503, 'Midtrans is not configured');

  const expected = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${env.midtrans.signatureSecretKey}`)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    throw new ApiError(401, 'Invalid Midtrans signature');
  }

  await withTransaction(async (connection) => {
    const [[tx]] = await connection.execute('SELECT * FROM transactions WHERE order_id = ? FOR UPDATE', [orderId]);
    if (!tx) throw new ApiError(404, 'Transaction not found');
    if (Number(grossAmount) !== Number(tx.amount)) throw new ApiError(400, 'Notification amount does not match transaction');

    const success = remoteStatus === 'settlement' || (remoteStatus === 'capture' && fraudStatus === 'accept');
    let status = success ? 'PAID' : MIDTRANS_STATUS_MAP[remoteStatus] || 'PENDING';
    if (tx.status === 'PAID') status = 'PAID';
    const newlyPaid = success && tx.status !== 'PAID';

    await connection.execute(
      `UPDATE transactions SET
         status = ?,
         payment_method = COALESCE(?, payment_method),
         midtrans_transaction_id = COALESCE(?, midtrans_transaction_id),
         midtrans_transaction_status = ?,
         paid_at = CASE WHEN ? = 1 THEN COALESCE(paid_at, NOW()) ELSE paid_at END
       WHERE id = ?`,
      [status, body.payment_type || null, body.transaction_id || null, remoteStatus, newlyPaid ? 1 : 0, tx.id]
    );

    if (newlyPaid) {
      const subscription = await loadSubscription(connection, tx.user_id, true);
      const active = subscription.effectiveStatus === 'PREMIUM';
      // Renewal extends from the current expiry; a new Premium starts now.
      const activeUntil = active ? new Date(subscription.expired_at) : new Date();
      const start = active ? new Date(subscription.started_at) : new Date();
      activeUntil.setDate(activeUntil.getDate() + env.premiumDurationDays);
      await connection.execute(
        "UPDATE subscriptions SET status = 'PREMIUM', started_at = ?, expired_at = ? WHERE id = ?",
        [start, activeUntil, subscription.id]
      );
    }
  });

  return { received: true };
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/**
 * Lists every released material, FREE and PREMIUM, for every user. The client
 * shows a Premium prompt for locked items; materialDetail enforces access.
 *
 * @param {{ page?: number, limit?: number }} query
 */
async function listMaterials(query) {
  const { page, limit, offset } = toPageArgs(query);
  const [items] = await pool.execute(
    `SELECT m.id, m.title, m.description, m.type, m.access_type, m.created_at, m.updated_at
     FROM materials m
     WHERE m.is_released = 1
     ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM materials m WHERE m.is_released = 1');
  return toPageResult(items, page, limit, total);
}

/**
 * @param {number} userId
 * @param {number} id
 */
async function materialDetail(userId, id) {
  const [[row]] = await pool.execute(
    `SELECT m.id, m.title, m.description, m.type, m.access_type, m.is_released, m.created_at, m.updated_at,
       a.id AS attachment_id, a.original_name, a.mime_type, a.file_size, a.object_key, a.created_at AS file_created_at
     FROM materials m JOIN attachments a ON a.id = m.attachment_id
     WHERE m.id = ?`,
    [id]
  );
  if (!row || !row.is_released) throw new ApiError(404, 'Material not found');
  await checkAccess(pool, userId, row.access_type);

  const { attachment_id, original_name, mime_type, file_size, object_key, file_created_at, ...material } = row;
  return {
    ...material,
    file: {
      id: attachment_id,
      original_filename: original_name,
      mime_type,
      size: file_size,
      created_at: file_created_at,
      url: await signedUrl(object_key)
    }
  };
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

/**
 * Lists every released assessment of `type`, FREE and PREMIUM, for every user.
 * assessmentDetail and startAttempt enforce Premium access.
 *
 * @param {AssessmentType} type
 * @param {{ page?: number, limit?: number }} query
 */
async function assessmentList(type, query) {
  const { page, limit, offset } = toPageArgs(query);
  const [items] = await pool.execute(
    `SELECT a.id, a.title, a.description, a.type, a.access_type, a.duration_minutes, COUNT(q.id) AS question_count
     FROM assessments a
     LEFT JOIN question_packages qp ON qp.assessment_id = a.id
     LEFT JOIN questions q ON q.question_package_id = qp.id
     WHERE a.type = ? AND a.is_released = 1
     GROUP BY a.id
     ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
    [type, limit, offset]
  );
  const [[{ total }]] = await pool.execute(
    'SELECT COUNT(*) AS total FROM assessments a WHERE a.type = ? AND a.is_released = 1',
    [type]
  );
  return toPageResult(items, page, limit, total);
}

/**
 * @param {number} userId
 * @param {AssessmentType} type
 * @param {number} id
 */
async function assessmentDetail(userId, type, id) {
  const [[row]] = await pool.execute(
    `SELECT a.id, a.title, a.description, a.type, a.access_type, a.duration_minutes,
       a.passing_score_twk, a.passing_score_tiu, a.passing_score_tkp, a.is_released,
       (SELECT COUNT(*) FROM questions q WHERE q.question_package_id = qp.id) AS question_count
     FROM assessments a JOIN question_packages qp ON qp.assessment_id = a.id
     WHERE a.id = ? AND a.type = ?`,
    [id, type]
  );
  if (!row || !row.is_released) throw new ApiError(404, 'Assessment not found');
  await checkAccess(pool, userId, row.access_type);

  const { is_released, ...assessment } = row;
  return assessment;
}

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

/**
 * Loads an attempt owned by the user. In-progress attempts also re-check that
 * the assessment is still released and accessible.
 *
 * @param {number} userId
 * @param {number} id
 * @param {boolean} [lock=false]
 * @param {Executor} [executor=pool]
 */
async function loadAttempt(userId, id, lock = false, executor = pool) {
  const [[row]] = await executor.execute(
    `SELECT at.*, a.type, a.access_type, a.is_released, a.duration_minutes
     FROM attempts at JOIN assessments a ON a.id = at.assessment_id
     WHERE at.id = ? AND at.user_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [id, userId]
  );
  if (!row) throw new ApiError(404, 'Attempt not found');
  if (row.status === 'IN_PROGRESS') {
    if (!row.is_released) throw new ApiError(404, 'Assessment not found');
    await checkAccess(executor, userId, row.access_type);
  }
  return row;
}

/**
 * Timer-facing view of an attempt. `server_time` lets the client measure
 * clock skew so the countdown follows the server deadline.
 *
 * @param {Record<string, any>} attempt
 */
function attemptState(attempt) {
  const now = new Date();
  return {
    attempt_id: attempt.id,
    assessment_id: attempt.assessment_id,
    status: attempt.status,
    started_at: attempt.started_at,
    expired_at: attempt.expired_at,
    server_time: now,
    remaining_seconds: attempt.expired_at
      ? Math.max(0, Math.floor((new Date(attempt.expired_at) - now) / 1000))
      : null
  };
}

/**
 * Starts an attempt, or returns the user's current IN_PROGRESS attempt.
 *
 * @param {number} userId
 * @param {AssessmentType} type
 * @param {number} id
 */
async function startAttempt(userId, type, id) {
  return withTransaction(async (connection) => {
    const [[assessment]] = await connection.execute(
      `SELECT a.*, qp.id AS question_package_id
       FROM assessments a JOIN question_packages qp ON qp.assessment_id = a.id
       WHERE a.id = ? AND a.type = ? AND a.is_released = 1 FOR UPDATE`,
      [id, type]
    );
    if (!assessment) throw new ApiError(404, 'Assessment not found');
    await checkAccess(connection, userId, assessment.access_type);

    const [[current]] = await connection.execute(
      "SELECT * FROM attempts WHERE user_id = ? AND assessment_id = ? AND status = 'IN_PROGRESS' ORDER BY id DESC LIMIT 1 FOR UPDATE",
      [userId, id]
    );
    if (current) return attemptState(current);

    const now = new Date();
    const expires = type === 'TRYOUT' ? new Date(now.getTime() + Number(assessment.duration_minutes) * 60000) : null;
    const [result] = await connection.execute(
      "INSERT INTO attempts (user_id, assessment_id, question_package_id, started_at, expired_at, status) VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS')",
      [userId, id, assessment.question_package_id, now, expires]
    );
    return attemptState({
      id: result.insertId,
      assessment_id: id,
      status: 'IN_PROGRESS',
      started_at: now,
      expired_at: expires
    });
  });
}

/**
 * Returns an in-progress attempt with its questions, options and saved answers.
 *
 * @param {number} userId
 * @param {number} id
 */
async function getAttempt(userId, id) {
  const attempt = await loadAttempt(userId, id);
  if (attempt.status !== 'IN_PROGRESS') throw new ApiError(409, 'Attempt is already finalized');

  const [rows] = await pool.execute(
    `SELECT q.id, q.question_number, qt.code AS question_type, q.question_text,
       qa.object_key AS question_object_key, qa.original_name AS question_original_name, qa.mime_type AS question_mime_type,
       ao.id AS option_id, ao.option_code, ao.option_text, ao.option_order,
       oa.object_key AS option_object_key, oa.original_name AS option_original_name, oa.mime_type AS option_mime_type,
       aa.selected_option_id
     FROM questions q
     JOIN question_types qt ON qt.id = q.question_type_id
     LEFT JOIN attachments qa ON qa.id = q.image_attachment_id
     LEFT JOIN answer_options ao ON ao.question_id = q.id
     LEFT JOIN attachments oa ON oa.id = ao.image_attachment_id
     LEFT JOIN attempt_answers aa ON aa.question_id = q.id AND aa.attempt_id = ?
     WHERE q.question_package_id = ?
     ORDER BY q.question_number, ao.option_order`,
    [id, attempt.question_package_id]
  );

  const questions = new Map();
  for (const row of rows) {
    if (!questions.has(row.id)) {
      questions.set(row.id, {
        id: row.id,
        number: row.question_number,
        type: row.question_type,
        text: row.question_text,
        answered: Boolean(row.selected_option_id),
        selected_option_id: row.selected_option_id,
        attachment: row.question_object_key
          ? { filename: row.question_original_name, mime_type: row.question_mime_type, url: await signedUrl(row.question_object_key) }
          : null,
        options: []
      });
    }
    if (row.option_id) {
      questions.get(row.id).options.push({
        id: row.option_id,
        code: row.option_code,
        text: row.option_text,
        order: row.option_order,
        attachment: row.option_object_key
          ? { filename: row.option_original_name, mime_type: row.option_mime_type, url: await signedUrl(row.option_object_key) }
          : null
      });
    }
  }

  return { ...attemptState(attempt), questions: [...questions.values()] };
}

/**
 * Upserts one answer. Try Out answers are rejected after the server deadline.
 *
 * @param {number} userId
 * @param {number} attemptId
 * @param {number} questionId
 * @param {number} optionId
 */
async function saveAnswer(userId, attemptId, questionId, optionId) {
  return withTransaction(async (connection) => {
    const attempt = await loadAttempt(userId, attemptId, true, connection);
    if (attempt.status !== 'IN_PROGRESS') throw new ApiError(409, 'Attempt is already finalized');
    if (attempt.type === 'TRYOUT' && new Date(attempt.expired_at) <= new Date()) {
      throw new ApiError(409, 'Tryout attempt has expired');
    }

    const [[question]] = await connection.execute(
      'SELECT id FROM questions WHERE id = ? AND question_package_id = ?',
      [questionId, attempt.question_package_id]
    );
    if (!question) throw new ApiError(400, 'Question does not belong to this assessment');

    const [[option]] = await connection.execute(
      'SELECT id FROM answer_options WHERE id = ? AND question_id = ?',
      [optionId, questionId]
    );
    if (!option) throw new ApiError(400, 'Selected option does not belong to this question');

    await connection.execute(
      `INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id, answered_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE selected_option_id = VALUES(selected_option_id), answered_at = NOW()`,
      [attemptId, questionId, optionId]
    );
    return {
      attempt_id: Number(attemptId),
      question_id: Number(questionId),
      selected_option_id: Number(optionId),
      answered: true
    };
  });
}

/**
 * @param {Record<string, any>} attempt
 * @param {Record<string, any>} result - attempt_results row
 */
function formatResult(attempt, result) {
  return {
    attempt_id: attempt.id,
    assessment_id: attempt.assessment_id,
    status: attempt.status,
    total_score: Number(result.total_score),
    twk_score: Number(result.twk_score),
    tiu_score: Number(result.tiu_score),
    tkp_score: Number(result.tkp_score),
    twk_passed: Boolean(result.twk_passed),
    tiu_passed: Boolean(result.tiu_passed),
    tkp_passed: Boolean(result.tkp_passed),
    total_correct: result.total_correct,
    total_wrong: result.total_wrong,
    total_unanswered: result.total_unanswered,
    completed_at: attempt.ended_at || attempt.updated_at
  };
}

/**
 * Finalizes an attempt and stores its score. Unanswered questions are allowed
 * and counted in `total_unanswered`. Submitting an already finalized attempt
 * returns the stored result (idempotent).
 *
 * @param {number} userId
 * @param {number} attemptId
 */
async function submitAttempt(userId, attemptId) {
  return withTransaction(async (connection) => {
    const attempt = await loadAttempt(userId, attemptId, true, connection);
    const [[previous]] = await connection.execute('SELECT * FROM attempt_results WHERE attempt_id = ?', [attemptId]);
    const [[feedback]] = await connection.execute(
      'SELECT id FROM feedbacks WHERE user_id = ? AND assessment_id = ? LIMIT 1',
      [userId, attempt.assessment_id]
    );
    const isFeedback = Boolean(feedback);

    if (attempt.status !== 'IN_PROGRESS') {
      if (previous) return { is_feedback: isFeedback, result: formatResult(attempt, previous) };
      throw new ApiError(409, 'Attempt cannot be finalized');
    }

    const expired = attempt.type === 'TRYOUT' && new Date(attempt.expired_at) <= new Date();
    const [[counts]] = await connection.execute(
      `SELECT COUNT(*) AS total_questions, COUNT(aa.selected_option_id) AS answered_questions
       FROM questions q
       LEFT JOIN attempt_answers aa ON aa.question_id = q.id AND aa.attempt_id = ?
       WHERE q.question_package_id = ?`,
      [attemptId, attempt.question_package_id]
    );
    const [answered] = await connection.execute(
      `SELECT qt.code, ao.score
       FROM questions q
       JOIN question_types qt ON qt.id = q.question_type_id
       JOIN attempt_answers aa ON aa.question_id = q.id AND aa.attempt_id = ?
       JOIN answer_options ao ON ao.id = aa.selected_option_id AND ao.question_id = q.id
       WHERE q.question_package_id = ?`,
      [attemptId, attempt.question_package_id]
    );

    const scores = { TWK: 0, TIU: 0, TKP: 0 };
    for (const row of answered) scores[row.code] += Number(row.score);
    const total = scores.TWK + scores.TIU + scores.TKP;
    const totalCorrect = answered.filter((row) => Number(row.score) > 0).length;
    const totalWrong = answered.length - totalCorrect;
    const totalUnanswered = Number(counts.total_questions) - Number(counts.answered_questions);

    const [[passing]] = await connection.execute(
      'SELECT passing_score_twk, passing_score_tiu, passing_score_tkp FROM assessments WHERE id = ?',
      [attempt.assessment_id]
    );
    const [inserted] = await connection.execute(
      `INSERT INTO attempt_results (attempt_id, total_score, twk_score, tiu_score, tkp_score,
         twk_passed, tiu_passed, tkp_passed, total_correct, total_wrong, total_unanswered)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attemptId,
        total,
        scores.TWK,
        scores.TIU,
        scores.TKP,
        scores.TWK >= Number(passing.passing_score_twk),
        scores.TIU >= Number(passing.passing_score_tiu),
        scores.TKP >= Number(passing.passing_score_tkp),
        totalCorrect,
        totalWrong,
        totalUnanswered
      ]
    );

    const status = expired ? 'EXPIRED' : 'COMPLETED';
    await connection.execute('UPDATE attempts SET status = ?, ended_at = NOW() WHERE id = ?', [status, attemptId]);
    const [[stored]] = await connection.execute('SELECT * FROM attempt_results WHERE id = ?', [inserted.insertId]);

    return { is_feedback: isFeedback, result: formatResult({ ...attempt, status, ended_at: new Date() }, stored) };
  });
}

/**
 * @param {number} userId
 * @param {AssessmentType} type
 * @param {number} attemptId
 */
async function result(userId, type, attemptId) {
  const [[row]] = await pool.execute(
    `SELECT at.id, at.assessment_id, at.status, at.ended_at, at.updated_at,
       ar.total_score, ar.twk_score, ar.tiu_score, ar.tkp_score, ar.twk_passed, ar.tiu_passed, ar.tkp_passed,
       ar.total_correct, ar.total_wrong, ar.total_unanswered
     FROM attempts at
     JOIN assessments a ON a.id = at.assessment_id
     JOIN attempt_results ar ON ar.attempt_id = at.id
     WHERE at.id = ? AND at.user_id = ? AND a.type = ?`,
    [attemptId, userId, type]
  );
  if (!row) throw new ApiError(404, 'Finalized result not found');
  return formatResult(row, row);
}

/**
 * Finalized attempts of one assessment for the user, newest first. Available
 * to Free and Premium users; it only exposes the user's own results.
 *
 * @param {number} userId
 * @param {AssessmentType} type
 * @param {number} assessmentId
 */
async function attemptHistory(userId, type, assessmentId) {
  const [rows] = await pool.execute(
    `SELECT at.id AS attempt_id, at.assessment_id, a.title AS assessment_title, at.status,
       COALESCE(at.ended_at, at.updated_at) AS completed_at,
       ar.total_score, ar.twk_score, ar.tiu_score, ar.tkp_score
     FROM attempts at
     JOIN assessments a ON a.id = at.assessment_id AND a.type = ?
     JOIN attempt_results ar ON ar.attempt_id = at.id
     WHERE at.user_id = ? AND at.assessment_id = ? AND at.status IN ${FINALIZED_STATUSES}
     ORDER BY completed_at DESC, at.id DESC`,
    [type, userId, assessmentId]
  );
  return rows.map((row) => ({
    ...row,
    total_score: Number(row.total_score),
    twk_score: Number(row.twk_score),
    tiu_score: Number(row.tiu_score),
    tkp_score: Number(row.tkp_score)
  }));
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

/**
 * Picks the finalized attempt whose answers are shown: the requested one when
 * `attemptId` is given, otherwise the user's latest.
 *
 * @param {number} userId
 * @param {number} assessmentId
 * @param {number} [attemptId]
 */
async function findReviewAttempt(userId, assessmentId, attemptId) {
  const [[attempt]] = attemptId
    ? await pool.execute(
      `SELECT id, question_package_id FROM attempts
       WHERE id = ? AND user_id = ? AND assessment_id = ? AND status IN ${FINALIZED_STATUSES}`,
      [attemptId, userId, assessmentId]
    )
    : await pool.execute(
      `SELECT id, question_package_id FROM attempts
       WHERE user_id = ? AND assessment_id = ? AND status IN ${FINALIZED_STATUSES}
       ORDER BY COALESCE(ended_at, updated_at) DESC, id DESC LIMIT 1`,
      [userId, assessmentId]
    );
  return attempt || null;
}

/**
 * Review of a finalized attempt. Every user gets each option's score, the
 * correct option for TWK/TIU (`is_correct`), and their own answer
 * (`is_selected`). Only Premium users get the written explanation and its image.
 *
 * @param {number} userId
 * @param {AssessmentType} type
 * @param {number} assessmentId
 * @param {number} [attemptId]
 */
async function explanations(userId, type, assessmentId, attemptId) {
  const [[assessment]] = await pool.execute(
    'SELECT id, access_type FROM assessments WHERE id = ? AND type = ? AND is_released = 1',
    [assessmentId, type]
  );
  if (!assessment) throw new ApiError(404, 'Assessment not found');

  const attempt = await findReviewAttempt(userId, assessmentId, attemptId);
  if (!attempt) {
    if (attemptId) throw new ApiError(404, 'Finalized attempt not found');
    throw new ApiError(403, 'Complete this assessment before viewing explanations');
  }
  await checkAccess(pool, userId, assessment.access_type);
  const premium = await isPremium(pool, userId);

  const [rows] = await pool.execute(
    `SELECT q.id, q.question_number, q.question_text, q.explanation, qt.code AS question_type,
       qi.object_key AS question_object_key, ei.object_key AS explanation_object_key,
       ao.id AS option_id, ao.option_code, ao.option_text, ao.score, oi.object_key AS option_object_key,
       aa.selected_option_id
     FROM questions q
     JOIN question_types qt ON qt.id = q.question_type_id
     LEFT JOIN attachments qi ON qi.id = q.image_attachment_id
     LEFT JOIN attachments ei ON ei.id = q.explanation_attachment_id
     LEFT JOIN answer_options ao ON ao.question_id = q.id
     LEFT JOIN attachments oi ON oi.id = ao.image_attachment_id
     LEFT JOIN attempt_answers aa ON aa.question_id = q.id AND aa.attempt_id = ?
     WHERE q.question_package_id = ?
     ORDER BY q.question_number, ao.option_order`,
    [attempt.id, attempt.question_package_id]
  );

  const questions = new Map();
  for (const row of rows) {
    if (!questions.has(row.id)) {
      const question = {
        id: row.id,
        number: row.question_number,
        type: row.question_type,
        question: row.question_text,
        question_image_url: await signedUrl(row.question_object_key),
        selected_option_id: row.selected_option_id || null,
        options: []
      };
      if (premium) {
        question.explanation = row.explanation;
        question.explanation_image_url = await signedUrl(row.explanation_object_key);
      }
      questions.set(row.id, question);
    }
    if (row.option_id) {
      questions.get(row.id).options.push({
        id: row.option_id,
        code: row.option_code,
        text: row.option_text,
        image_url: await signedUrl(row.option_object_key),
        score: Number(row.score),
        is_selected: row.option_id === row.selected_option_id,
        is_correct: false
      });
    }
  }

  for (const question of questions.values()) {
    if (!SINGLE_ANSWER_TYPES.has(question.type)) continue;
    const best = Math.max(0, ...question.options.map((option) => option.score));
    if (best <= 0) continue;
    for (const option of question.options) option.is_correct = option.score === best;
  }

  return [...questions.values()];
}

// ---------------------------------------------------------------------------
// Feedback and statistics
// ---------------------------------------------------------------------------

/**
 * One feedback per user and assessment, after a finalized attempt.
 *
 * @param {number} userId
 * @param {number} assessmentId
 * @param {{ rating: number, difficulty: 'EASY'|'MEDIUM'|'HARD', comment?: string|null }} data
 */
async function createFeedback(userId, assessmentId, data) {
  const [[assessment]] = await pool.execute('SELECT id FROM assessments WHERE id = ? AND is_released = 1', [assessmentId]);
  if (!assessment) throw new ApiError(404, 'Assessment not found');

  const [[finished]] = await pool.execute(
    `SELECT id FROM attempts WHERE user_id = ? AND assessment_id = ? AND status IN ${FINALIZED_STATUSES} LIMIT 1`,
    [userId, assessmentId]
  );
  if (!finished) throw new ApiError(403, 'Feedback can be submitted after completing an attempt');

  const comment = data.comment || null;
  try {
    const [inserted] = await pool.execute(
      'INSERT INTO feedbacks (user_id, assessment_id, rating, difficulty, comment) VALUES (?, ?, ?, ?, ?)',
      [userId, assessmentId, data.rating, data.difficulty, comment]
    );
    return { id: inserted.insertId, assessment_id: Number(assessmentId), rating: data.rating, difficulty: data.difficulty, comment };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'Feedback has already been submitted for this assessment');
    throw error;
  }
}

/**
 * Every finalized Try Out attempt of the user, oldest first. Premium only.
 *
 * @param {number} userId
 */
async function statistics(userId) {
  await checkAccess(pool, userId, 'PREMIUM');
  const [rows] = await pool.execute(
    `SELECT at.id AS attempt_id, a.id AS assessment_id, a.title AS assessment_title, at.ended_at AS completed_at,
       ar.total_score, ar.twk_score, ar.tiu_score, ar.tkp_score
     FROM attempts at
     JOIN assessments a ON a.id = at.assessment_id
     JOIN attempt_results ar ON ar.attempt_id = at.id
     WHERE at.user_id = ? AND a.type = 'TRYOUT' AND at.status IN ${FINALIZED_STATUSES}
     ORDER BY at.ended_at, at.id`,
    [userId]
  );
  return rows.map((row) => ({
    ...row,
    total_score: Number(row.total_score),
    twk_score: Number(row.twk_score),
    tiu_score: Number(row.tiu_score),
    tkp_score: Number(row.tkp_score)
  }));
}

module.exports = {
  offer,
  getSubscription,
  createPayment,
  transactionHistory,
  midtransNotification,
  listMaterials,
  materialDetail,
  assessmentList,
  assessmentDetail,
  startAttempt,
  getAttempt,
  saveAnswer,
  submitAttempt,
  result,
  attemptHistory,
  explanations,
  createFeedback,
  statistics
};
