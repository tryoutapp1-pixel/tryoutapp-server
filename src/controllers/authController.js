const authService = require('../services/authService');

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */

/** @param {Request} req @param {Response} res */
async function signup(req, res) {
  const data = await authService.signup(req.body);
  res.status(201).json({ success: true, message: 'Signup successful. Please check your email to verify your account.', data });
}

/** @param {Request} req @param {Response} res */
async function login(req, res) {
  const data = await authService.login(req.body);
  res.json({ success: true, message: 'Login successful', data });
}

/** @param {Request} req @param {Response} res */
function logout(req, res) {
  res.json({
    success: true,
    message: 'Logout successful. Remove the access token from the client; stateless JWTs are not revoked by this endpoint.'
  });
}

/** @param {Request} req @param {Response} res */
async function verifyEmail(req, res) {
  await authService.verifyEmail(req.query.token);
  res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
}

/** @param {Request} req @param {Response} res */
async function resendVerification(req, res) {
  await authService.resendVerification(req.body.email);
  res.json({ success: true, message: 'If the account is pending verification, a new verification email has been sent.' });
}

/** @param {Request} req @param {Response} res */
async function forgotPassword(req, res) {
  await authService.forgotPassword(req.body.email);
  res.json({ success: true, message: 'If an active account exists for this email, a password reset email has been sent.' });
}

/** @param {Request} req @param {Response} res */
async function resetPassword(req, res) {
  await authService.resetPassword(req.body.token, req.body.newPassword);
  res.json({ success: true, message: 'Password reset successful' });
}

/** @param {Request} req @param {Response} res */
async function changePassword(req, res) {
  await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  res.json({ success: true, message: 'Password changed successfully' });
}

module.exports = { signup, login, logout, verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword };
