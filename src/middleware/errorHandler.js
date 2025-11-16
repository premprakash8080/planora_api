// Error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', err);

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map(e => e.message).join(', ');
    error = {
      success: false,
      message: 'Validation Error',
      errors: err.errors.map(e => ({
        field: e.path,
        message: e.message,
      })),
    };
    return res.status(400).json(error);
  }

  // Sequelize unique constraint error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = 'Duplicate entry. This record already exists.';
    error = {
      success: false,
      message,
      field: err.errors[0]?.path,
    };
    return res.status(409).json(error);
  }

  // Sequelize foreign key constraint error
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = {
      success: false,
      message: 'Invalid reference. Related record does not exist.',
    };
    return res.status(400).json(error);
  }

  // Sequelize database error
  if (err.name === 'SequelizeDatabaseError') {
    error = {
      success: false,
      message: 'Database error occurred',
    };
    return res.status(500).json(error);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      success: false,
      message: 'Invalid token',
    };
    return res.status(401).json(error);
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      success: false,
      message: 'Token expired',
    };
    return res.status(401).json(error);
  }

  // Default error
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// 404 handler
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = { errorHandler, notFound };

