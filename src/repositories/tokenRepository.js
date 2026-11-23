/**
 * Shared access for the email-verification and password-reset token tables.
 * `table` is always one of the constants in authService, never user input.
 */

/** @typedef {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} Executor */
/** @typedef {'email_verification_tokens'|'password_reset_tokens'} TokenTable */

/**
 * Marks every unused token of the user as used.
 *
 * @param {Executor} executor
 * @param {TokenTable} table
 * @param {number} userId
 */
async function invalidateUnused(executor, table, userId) {
  await executor.execute(`UPDATE ${table} SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL`, [userId]);
}

/**
 * @param {Executor} executor
 * @param {TokenTable} table
 * @param {number} userId
 * @param {string} tokenHash
 * @param {Date} expiresAt
 */
async function create(executor, table, userId, tokenHash, expiresAt) {
  await executor.execute(`INSERT INTO ${table} (user_id, token_hash, expires_at) VALUES (?, ?, ?)`, [userId, tokenHash, expiresAt]);
}

/**
 * Unused token by hash; expiry is checked by the caller.
 *
 * @param {Executor} executor
 * @param {TokenTable} table
 * @param {string} tokenHash
 */
async function findUsableByHash(executor, table, tokenHash) {
  const [rows] = await executor.execute(`SELECT * FROM ${table} WHERE token_hash = ? AND used_at IS NULL LIMIT 1`, [tokenHash]);
  return rows[0] || null;
}

/**
 * @param {Executor} executor
 * @param {TokenTable} table
 * @param {number} id
 */
async function markUsed(executor, table, id) {
  await executor.execute(`UPDATE ${table} SET used_at = NOW() WHERE id = ? AND used_at IS NULL`, [id]);
}

module.exports = { invalidateUnused, create, findUsableByHash, markUsed };
