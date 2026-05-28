const { verifyToken } = require('../utils/jwt');

/**
 * Authentication middleware to verify JWT.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Token format is invalid. Expected: Bearer <token>' });
  }

  const token = parts[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  // Attach decoded user info (e.g. userId, email, phone) to request object
  req.user = decoded;
  next();
}

module.exports = authMiddleware;
