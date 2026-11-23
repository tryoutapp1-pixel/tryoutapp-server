const pool = require('../config/database');

/**
 * Runs `work` inside a single database transaction. Commits when `work`
 * resolves, rolls back and rethrows when it rejects, and always releases the
 * connection back to the pool.
 *
 * @template T
 * @param {(connection: import('mysql2/promise').PoolConnection) => Promise<T>} work
 * @returns {Promise<T>}
 */
async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { withTransaction };
