const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { env } = require('../config/env');
const users = require('../repositories/userRepository');
const tokens = require('../repositories/tokenRepository');
const emailService = require('./emailService');
const ApiError = require('../utils/ApiError');
const { generateToken, hashToken, expiryDate } = require('../utils/tokens');
const { withTransaction } = require('../utils/transaction');

const VERIFICATION_TABLE = 'email_verification_tokens';
const RESET_TABLE = 'password_reset_tokens';
const BCRYPT_ROUNDS = 12;
const VERIFICATION_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;

/**
 * Creates a PENDING_VERIFICATION user with a FREE subscription and emails a
 * verification link. A failed email rolls the whole signup back.
 *
 * @param {{ name: string, email: string, password: string }} input
 */
async function signup({ name, email, password }) {
  return withTransaction(async (connection) => {
    if (await users.findByEmail(connection, email)) throw new ApiError(409, 'Email is already registered');
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const userId = await users.create(connection, { name, email, passwordHash });
    await connection.execute(
      "INSERT INTO subscriptions (user_id, status, started_at, expired_at) VALUES (?, 'FREE', NULL, NULL)",
      [userId]
    );
    const rawToken = generateToken();
    await tokens.create(connection, VERIFICATION_TABLE, userId, hashToken(rawToken), expiryDate(VERIFICATION_TTL_HOURS));
    // SMTP is intentionally awaited before commit: failed delivery rolls back user and token.
    await emailService.sendVerificationEmail({ email, name, token: rawToken });
    return { userId, name, email };
  });
}

/**
 * Returns a signed JWT for an ACTIVE user with matching credentials.
 *
 * @param {{ email: string, password: string }} input
 */
async function login({ email, password }) {
  const user = await users.findByEmail(pool, email);
  if (!user || user.status !== 'ACTIVE' || !(await bcrypt.compare(password, user.password_hash))) {
    throw new ApiError(401, 'Invalid email or password, or account is not active');
  }
  // No expiresIn by design: access tokens remain valid while their signature is valid.
  const accessToken = jwt.sign({ userId: user.id, role: user.role }, env.jwtSecret);
  return { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

/** @param {string} rawToken - Token from the verification link */
async function verifyEmail(rawToken) {
  return withTransaction(async (connection) => {
    const record = await tokens.findUsableByHash(connection, VERIFICATION_TABLE, hashToken(rawToken));
    if (!record) throw new ApiError(400, 'Invalid or already used verification link');
    if (new Date(record.expires_at) <= new Date()) throw new ApiError(400, 'Verification link has expired');
    const user = await users.findById(connection, record.user_id);
    if (!user || user.status !== 'PENDING_VERIFICATION') throw new ApiError(400, 'Verification link is no longer valid');
    await connection.execute("UPDATE users SET status = 'ACTIVE', email_verified_at = NOW() WHERE id = ?", [user.id]);
    await tokens.markUsed(connection, VERIFICATION_TABLE, record.id);
  });
}

/** @param {string} email */
async function resendVerification(email) {
  const existing = await users.findByEmail(pool, email);
  // Same response for unknown, already active, and pending accounts prevents account enumeration.
  if (!existing || existing.status !== 'PENDING_VERIFICATION') return;
  await withTransaction(async (connection) => {
    const user = await users.findByEmail(connection, email);
    if (!user || user.status !== 'PENDING_VERIFICATION') return;
    const rawToken = generateToken();
    await tokens.invalidateUnused(connection, VERIFICATION_TABLE, user.id);
    await tokens.create(connection, VERIFICATION_TABLE, user.id, hashToken(rawToken), expiryDate(VERIFICATION_TTL_HOURS));
    await emailService.sendVerificationEmail({ email: user.email, name: user.name, token: rawToken });
  });
}

/** @param {string} email */
async function forgotPassword(email) {
  const existing = await users.findByEmail(pool, email);
  // Deliberately indistinguishable response for absent or inactive accounts.
  if (!existing || existing.status !== 'ACTIVE') return;
  await withTransaction(async (connection) => {
    const user = await users.findByEmail(connection, email);
    if (!user || user.status !== 'ACTIVE') return;
    const rawToken = generateToken();
    await tokens.invalidateUnused(connection, RESET_TABLE, user.id);
    await tokens.create(connection, RESET_TABLE, user.id, hashToken(rawToken), expiryDate(RESET_TTL_HOURS));
    await emailService.sendPasswordResetEmail({ email: user.email, name: user.name, token: rawToken });
  });
}

/**
 * @param {string} rawToken - Token from the reset link
 * @param {string} newPassword
 */
async function resetPassword(rawToken, newPassword) {
  await withTransaction(async (connection) => {
    const record = await tokens.findUsableByHash(connection, RESET_TABLE, hashToken(rawToken));
    if (!record) throw new ApiError(400, 'Invalid or already used reset token');
    if (new Date(record.expires_at) <= new Date()) throw new ApiError(400, 'Reset token has expired');
    await users.updatePassword(connection, record.user_id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
    await tokens.markUsed(connection, RESET_TABLE, record.id);
  });
}

/**
 * @param {number} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await users.findById(pool, userId);
  if (!user) throw new ApiError(401, 'User no longer exists');
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) throw new ApiError(400, 'Current password is incorrect');
  await users.updatePassword(pool, userId, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
}

module.exports = { signup, login, verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword };
