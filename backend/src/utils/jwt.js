const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'e_faws_super_secure_jwt_secret_key_123!';
const JWT_EXPIRES_IN = '7d';

/**
 * Generate a JWT token for a user.
 * @param {object} payload - The token payload (e.g. { userId, email, phone })
 * @returns {string} Signed JWT.
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify a JWT token.
 * @param {string} token - The JWT string to verify.
 * @returns {object|null} Decoded payload if valid, null otherwise.
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken
};
