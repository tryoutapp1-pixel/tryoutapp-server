/** @typedef {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} Executor */

/**
 * @param {Executor} executor
 * @param {string} email
 */
async function findByEmail(executor, email) {
  const [rows] = await executor.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

/**
 * @param {Executor} executor
 * @param {number} id
 */
async function findById(executor, id) {
  const [rows] = await executor.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

/**
 * Inserts a USER in PENDING_VERIFICATION state.
 *
 * @param {Executor} executor
 * @param {{ name: string, email: string, passwordHash: string }} user
 * @returns {Promise<number>} The new user id
 */
async function create(executor, { name, email, passwordHash }) {
  const [result] = await executor.execute(
    "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'USER', 'PENDING_VERIFICATION')",
    [name, email, passwordHash]
  );
  return result.insertId;
}

/**
 * @param {Executor} executor
 * @param {number} userId
 * @param {string} passwordHash
 */
async function updatePassword(executor, userId, passwordHash) {
  await executor.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

/**
 * @param {Executor} executor
 * @param {number} userId
 * @param {string} name
 */
async function updateName(executor, userId, name) {
  await executor.execute('UPDATE users SET name = ? WHERE id = ?', [name, userId]);
}

module.exports = { findByEmail, findById, create, updatePassword, updateName };
