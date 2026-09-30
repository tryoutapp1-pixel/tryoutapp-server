const pool = require('../config/database');
const users = require('../repositories/userRepository');
const ApiError = require('../utils/ApiError');

function publicProfile(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, emailVerifiedAt: user.email_verified_at };
}

async function getMe(req, res, next) {
  try {
    const user = await users.findById(pool, req.user.id);
    if (!user) throw new ApiError(404, 'User not found');
    res.json({ success: true, data: publicProfile(user) });
  } catch (error) { next(error); }
}

async function updateMe(req, res, next) {
  try {
    await users.updateName(pool, req.user.id, req.body.name.trim());
    const user = await users.findById(pool, req.user.id);
    if (!user) throw new ApiError(404, 'User not found');
    res.json({ success: true, message: 'Profile updated successfully', data: publicProfile(user) });
  } catch (error) { next(error); }
}

module.exports = { getMe, updateMe };
