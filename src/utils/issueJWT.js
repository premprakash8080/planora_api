const jwt = require("jsonwebtoken");

const dotenv = require("dotenv");
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_PRIVATE_KEY;

/**
 * Issue JWT token for user
 * @param {number} id - User ID
 * @param {string} role - User role (optional)
 * @returns {Object} Token object with token and expires
 */
const issueJWT = (id, role = 'user') => {
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  const payload = {
    id,
    role,
    iat: Math.floor(Date.now() / 1000),
  };

  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET or JWT_PRIVATE_KEY must be set in environment variables');
  }

  const signedToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: expiresIn,
  });

  return {
    token: signedToken,
    expires: expiresIn,
  };
};

module.exports = { issueJWT };
