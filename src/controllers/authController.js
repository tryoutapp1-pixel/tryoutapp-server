const authService = require('../services/authService');

async function signup(req, res, next) {
  try {
    const data = await authService.signup(req.body);
    res.status(201).json({ success: true, message: 'Signup successful. Please check your email to verify your account.', data });
  } catch (error) { next(error); }
}

async function login(req, res, next) {
  try {
    const data = await authService.login(req.body);
    res.json({ success: true, message: 'Login successful', data });
  } catch (error) { next(error); }
}

function logout(req, res) {
  res.json({ success: true, message: 'Logout successful. Remove the access token from the client; stateless JWTs are not revoked by this endpoint.' });
}

async function verifyEmail(req, res, next) {
  try {
    await authService.verifyEmail(req.query.token);
    res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error) { next(error); }
}

async function resendVerification(req, res, next) {
  try {
    await authService.resendVerification(req.body.email);
    res.json({ success: true, message: 'If the account is pending verification, a new verification email has been sent.' });
  } catch (error) { next(error); }
}

async function forgotPassword(req, res, next) {
  try {
    await authService.forgotPassword(req.body.email);
    res.json({ success: true, message: 'If an active account exists for this email, a password reset email has been sent.' });
  } catch (error) { next(error); }
}

async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) { next(error); }
}

async function changePassword(req, res, next) {
  try {
    await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) { next(error); }
}

module.exports = { signup, login, logout, verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword };
