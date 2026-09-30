const { body, query } = require('express-validator');

const password = (field) => body(field).isString().isLength({ min: 8 }).withMessage(`${field} must be at least 8 characters`);
const email = body('email').trim().isEmail().withMessage('email must be valid').normalizeEmail();

const signup = [body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 100 }), email, password('password')];
const login = [email, body('password').isString().notEmpty().withMessage('password is required')];
const emailOnly = [email];
const resetPassword = [body('token').isString().notEmpty().withMessage('token is required'), password('newPassword')];
const changePassword = [body('currentPassword').isString().notEmpty().withMessage('currentPassword is required'), password('newPassword')];
const verifyEmail = [query('token').isString().notEmpty().withMessage('token is required')];

module.exports = { signup, login, emailOnly, resetPassword, changePassword, verifyEmail };
