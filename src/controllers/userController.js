const pool = require('../config/database');
const users = require('../repositories/userRepository');
const ApiError = require('../utils/ApiError');

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */

/**
 * Fields of a user that are safe to return to the client.
 *
 * @param {Record<string, any>} user - users row
 */
function publicProfile(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.email_verified_at
  };
}

/** @param {number} id */
async function findUserOrThrow(id) {
  const user = await users.findById(pool, id);
  if (!user) throw new ApiError(404, 'User not found');
  return user;
}

/** @param {Request} req @param {Response} res */
async function getMe(req, res) {
  res.json({ success: true, data: publicProfile(await findUserOrThrow(req.user.id)) });
}

/** @param {Request} req @param {Response} res */
async function updateMe(req, res) {
  await users.updateName(pool, req.user.id, req.body.name.trim());
  res.json({ success: true, message: 'Profile updated successfully', data: publicProfile(await findUserOrThrow(req.user.id)) });
}

module.exports = { getMe, updateMe };
