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

// Validate project ID from params (for backward compatibility)
const validateProjectIdParam = [
  param('projectId')
    .isInt().withMessage('Project ID must be a valid integer'),
  handleValidationErrors,
];

// Validate project ID from body (new approach)
const validateProjectId = [
  body('project_id')
    .optional()
    .isInt().withMessage('Project ID must be a valid integer'),
  body('projectId')
    .optional()
    .isInt().withMessage('Project ID must be a valid integer'),
  (req, res, next) => {
    // At least one of project_id or projectId must be present
    if (!req.body.project_id && !req.body.projectId) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'project_id', message: 'Project ID is required in request body' }],
      });
    }
    next();
  },
  handleValidationErrors,
];

// Task validation rules (for creation)
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

// Task validation rules (for updates - all fields optional)
const validateTaskUpdate = [
  body('task_id')
    .optional()
    .isInt().withMessage('Task ID must be a valid integer'),
  body('project_id')
    .optional()
    .isInt().withMessage('Project ID must be a valid integer'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 }).withMessage('Task title must be between 1 and 255 characters'),
  body('description')
    .optional()
    .isString().withMessage('Description must be a string'),
  body('assigned_to')
    .optional()
    .isInt().withMessage('Assigned to must be a valid integer'),
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High']).withMessage('Priority must be Low, Medium, or High'),
  body('status')
    .optional()
    .isIn(['To Do', 'In Progress', 'Done', 'On Track', 'At Risk', 'Off Track']).withMessage('Invalid task status'),
  body('due_date')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return true; // Allow null/empty to unset
      return /^\d{4}-\d{2}-\d{2}/.test(value) || new Date(value).toString() !== 'Invalid Date';
    }).withMessage('Due date must be a valid date (YYYY-MM-DD)'),
  body('section_id')
    .optional()
    .isInt().withMessage('Section ID must be a valid integer'),
  body('position')
    .optional()
    .isInt().withMessage('Position must be a valid integer'),
  body('completed')
    .optional()
    .isBoolean().withMessage('Completed must be a boolean'),
  handleValidationErrors,
];

const validateTaskId = [
  param('taskId')
    .isInt().withMessage('Task ID must be a valid integer'),
  handleValidationErrors,
];

// Validate task ID from body (for update operations)
const validateTaskIdBody = [
  body('task_id')
    .notEmpty().withMessage('Task ID is required')
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

// Validate section ID from params (for backward compatibility)
const validateSectionIdParam = [
  param('sectionId')
    .isInt().withMessage('Section ID must be a valid integer'),
  handleValidationErrors,
];

// Validate section ID from body (new approach)
const validateSectionId = [
  body('section_id')
    .optional()
    .isInt().withMessage('Section ID must be a valid integer'),
  body('sectionId')
    .optional()
    .isInt().withMessage('Section ID must be a valid integer'),
  (req, res, next) => {
    // At least one of section_id or sectionId must be present for update/delete operations
    if ((req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') && 
        !req.body.section_id && !req.body.sectionId) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'section_id', message: 'Section ID is required in request body' }],
      });
    }
    next();
  },
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

const validateMemberId = [
  param('id')
    .isInt({ min: 1 }).withMessage('Member ID must be a positive integer'),
  handleValidationErrors,
];

const validateUserId = [
  param('userId')
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  handleValidationErrors,
];

// Mail validation rules
const validateMailId = [
  param('mailId')
    .isInt({ min: 1 }).withMessage('Mail ID must be a positive integer'),
  handleValidationErrors,
];

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateProject,
  validateProjectId,
  validateTask,
  validateTaskUpdate,
  validateTaskId,
  validateTaskIdBody,
  validateSection,
  validateSectionId,
  validateTeam,
  validateTeamId,
  validateTaskComment,
  validateCommentId,
  validateMemberId,
  validateUserId,
  validateMailId,
  handleValidationErrors,
};

