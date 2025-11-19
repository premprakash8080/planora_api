/**
 * Unified API Response Formatter
 * Ensures consistent response structure across all endpoints
 */

/**
 * Success response formatter
 * @param {any} data - Response data
 * @param {string} message - Optional success message
 * @param {object} meta - Optional metadata (pagination, etc.)
 */
const successResponse = (data, message = null, meta = null) => {
  const response = {
    success: true,
    data
  };

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  return response;
};

/**
 * Error response formatter
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {any} errors - Optional detailed errors
 */
const errorResponse = (message, statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
    statusCode
  };

  if (errors) {
    response.errors = errors;
  }

  return response;
};

/**
 * Pagination metadata formatter
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 */
const paginationMeta = (page, limit, total) => {
  return {
    pagination: {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      total,
      totalPages: Math.ceil(total / (parseInt(limit) || 10))
    }
  };
};

module.exports = {
  successResponse,
  errorResponse,
  paginationMeta
};

