/**
 * Centralized Error Handling Middleware
 * Provides consistent error responses across the application
 */

const { errorResponse } = require('../utils/responseFormatter');

// 404 Not Found handler
const notFound = (req, res, next) => {
  res.status(404).json(errorResponse(`Route ${req.method} ${req.originalUrl} not found`, 404));
};

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => ({
      field: e.path,
      message: e.message
    }));
    return res.status(400).json(errorResponse('Validation error', 400, errors));
  }

  // Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json(errorResponse('Resource already exists', 409));
  }

  // Sequelize foreign key constraint errors
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json(errorResponse('Invalid reference to related resource', 400));
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json(errorResponse('Invalid or expired token', 401));
  }

  // Custom application errors
  if (err.statusCode) {
    return res.status(err.statusCode).json(errorResponse(err.message, err.statusCode, err.errors));
  }

  // Default server error
  res.status(500).json(errorResponse(
    process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    500
  ));
};

module.exports = {
  notFound,
  errorHandler
};
