async function invalidateUnused(executor, table, userId) {
  await executor.execute(`UPDATE ${table} SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL`, [userId]);
}

async function create(executor, table, userId, tokenHash, expiresAt) {
  await executor.execute(
    `INSERT INTO ${table} (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
    [userId, tokenHash, expiresAt]
  );
}

async function findUsableByHash(executor, table, tokenHash) {
  const [rows] = await executor.execute(
    `SELECT * FROM ${table} WHERE token_hash = ? AND used_at IS NULL LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function markUsed(executor, table, id) {
  await executor.execute(`UPDATE ${table} SET used_at = NOW() WHERE id = ? AND used_at IS NULL`, [id]);
}

module.exports = { invalidateUnused, create, findUsableByHash, markUsed };
