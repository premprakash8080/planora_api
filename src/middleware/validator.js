// Input validation middleware
const { body, param, query, validationResult } = require('express-validator');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

// User validation rules
const validateUserRegistration = [
  body('full_name')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 150 }).withMessage('Full name must be between 2 and 150 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors,
];

const validateUserLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

// Project validation rules
const validateProject = [
  body('name')
    .trim()
    .notEmpty().withMessage('Project name is required')
    .isLength({ min: 1, max: 255 }).withMessage('Project name must be between 1 and 255 characters'),
  body('status')
    .optional()
    .isIn(['not-started', 'in-progress', 'on-hold', 'completed']).withMessage('Invalid project status'),
  body('color')
    .optional()
    .isLength({ max: 20 }).withMessage('Color must be 20 characters or less'),
  handleValidationErrors,
];

const validateProjectId = [
  param('projectId')
    .isInt().withMessage('Project ID must be a valid integer'),
  handleValidationErrors,
];

// Task validation rules
const validateTask = [
  body('project_id')
    .notEmpty().withMessage('Project ID is required')
    .isInt().withMessage('Project ID must be a valid integer'),
  body('title')
    .trim()
    .notEmpty().withMessage('Task title is required')
    .isLength({ min: 1, max: 255 }).withMessage('Task title must be between 1 and 255 characters'),
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High']).withMessage('Priority must be Low, Medium, or High'),
  body('status')
    .optional()
    .isIn(['To Do', 'In Progress', 'Done', 'On Track', 'At Risk', 'Off Track']).withMessage('Invalid task status'),
  body('due_date')
    .optional()
    .isISO8601().withMessage('Due date must be a valid date (YYYY-MM-DD)'),
  body('section_id')
    .optional()
    .isInt().withMessage('Section ID must be a valid integer'),
  body('position')
    .optional()
    .isInt().withMessage('Position must be a valid integer'),
  handleValidationErrors,
];

const validateTaskId = [
  param('taskId')
    .isInt().withMessage('Task ID must be a valid integer'),
  handleValidationErrors,
];

// Section validation rules
const validateSection = [
  body('project_id')
    .notEmpty().withMessage('Project ID is required')
    .isInt().withMessage('Project ID must be a valid integer'),
  body('name')
    .trim()
    .notEmpty().withMessage('Section name is required')
    .isLength({ min: 1, max: 150 }).withMessage('Section name must be between 1 and 150 characters'),
  body('position')
    .optional()
    .isInt().withMessage('Position must be a valid integer'),
  handleValidationErrors,
];

const validateSectionId = [
  param('sectionId')
    .isInt().withMessage('Section ID must be a valid integer'),
  handleValidationErrors,
];

// Team validation rules
const validateTeam = [
  body('name')
    .trim()
    .notEmpty().withMessage('Team name is required')
    .isLength({ min: 1, max: 150 }).withMessage('Team name must be between 1 and 150 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 }).withMessage('Description must be 1000 characters or less'),
  handleValidationErrors,
];

const validateTeamId = [
  param('teamId')
    .isInt().withMessage('Team ID must be a valid integer'),
  handleValidationErrors,
];

// Task comment validation rules
const validateTaskComment = [
  body('task_id')
    .notEmpty().withMessage('Task ID is required')
    .isInt().withMessage('Task ID must be a valid integer'),
  body('message')
    .trim()
    .notEmpty().withMessage('Comment message is required')
    .isLength({ min: 1 }).withMessage('Comment message cannot be empty'),
  handleValidationErrors,
];

const validateCommentId = [
  param('commentId')
    .isInt().withMessage('Comment ID must be a valid integer'),
  handleValidationErrors,
];

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateProject,
  validateProjectId,
  validateTask,
  validateTaskId,
  validateSection,
  validateSectionId,
  validateTeam,
  validateTeamId,
  validateTaskComment,
  validateCommentId,
  handleValidationErrors,
};

