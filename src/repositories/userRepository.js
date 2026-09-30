async function findByEmail(executor, email) {
  const [rows] = await executor.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function findById(executor, id) {
  const [rows] = await executor.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function create(executor, { name, email, passwordHash }) {
  const [result] = await executor.execute(
    "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'USER', 'PENDING_VERIFICATION')",
    [name, email, passwordHash]
  );
  return result.insertId;
}

async function updatePassword(executor, userId, passwordHash) {
  await executor.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

async function updateName(executor, userId, name) {
  await executor.execute('UPDATE users SET name = ? WHERE id = ?', [name, userId]);
}

module.exports = { findByEmail, findById, create, updatePassword, updateName };
