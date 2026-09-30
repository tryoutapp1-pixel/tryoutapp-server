const { body } = require('express-validator');

const updateProfile = [
  body('name').exists().withMessage('name is required').bail().isString().withMessage('name must be a string').bail().trim().notEmpty().withMessage('name cannot be empty').isLength({ max: 100 })
];

module.exports = { updateProfile };
