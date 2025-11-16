const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    // Check for authorization header
    if (!req.headers.authorization) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No token provided',
      });
    }

    // Extract token from "Bearer <token>"
    const token = req.headers.authorization.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid token format',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.JWT_PRIVATE_KEY);
    
    // Find user
    const user = await User.findByPk(decoded.id);
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not found or inactive',
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid token',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Token expired',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message,
    });
  }
};

module.exports = { authenticate };

