const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function generateToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    region_id: user.region_id,
    office_id: user.office_id
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Missing Authorization header' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Invalid Authorization header' });
  }

  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    console.error('JWT error', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (!allowed.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: `Forbidden for role ${req.user.role}` });
    }
    next();
  };
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authMiddleware,
  requireRole
};
