const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'FamilyChoresJWT2025SecretKey!';

// Generate JWT token
const generateToken = (payload, expiresIn = '24h') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    // Verify admin user exists and is active
    const [adminRows] = await db.query(
      'SELECT id, username, email FROM admin_users WHERE id = ?',
      [decoded.adminId]
    );
    
    if (adminRows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid admin token'
      });
    }
    
    req.admin = adminRows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }
    
    console.error('Admin auth error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

// Family authentication middleware
const authenticateFamily = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    // Verify family exists and is active
    const [familyRows] = await db.query(
      'SELECT id, name, family_code, is_active FROM families WHERE id = ? AND is_active = TRUE',
      [decoded.familyId]
    );
    
    if (familyRows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid family token'
      });
    }
    
    req.family = familyRows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }
    
    console.error('Family auth error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

// User authentication middleware
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    // Verify user exists and is active
    const [userRows] = await db.query(
      `SELECT u.id, u.family_id, u.name, u.role, u.email, u.earnings, u.is_active,
              f.name as family_name, f.family_code, f.is_active as family_active
       FROM users u
       JOIN families f ON u.family_id = f.id
       WHERE u.id = ? AND u.is_active = TRUE AND f.is_active = TRUE`,
      [decoded.userId]
    );
    
    if (userRows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid user token'
      });
    }
    
    req.user = userRows[0];
    req.family = {
      id: userRows[0].family_id,
      name: userRows[0].family_name,
      family_code: userRows[0].family_code,
      is_active: userRows[0].family_active
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }
    
    console.error('User auth error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

// Parent role authorization middleware
const requireParent = (req, res, next) => {
  if (!req.user || req.user.role !== 'parent') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Parent role required'
    });
  }
  next();
};

// Child role authorization middleware
const requireChild = (req, res, next) => {
  if (!req.user || req.user.role !== 'child') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Child role required'
    });
  }
  next();
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (decoded.userId) {
      // User token
      const [userRows] = await db.query(
        `SELECT u.id, u.family_id, u.name, u.role, u.email, u.earnings, u.is_active,
                f.name as family_name, f.family_code, f.is_active as family_active
         FROM users u
         JOIN families f ON u.family_id = f.id
         WHERE u.id = ? AND u.is_active = TRUE AND f.is_active = TRUE`,
        [decoded.userId]
      );
      
      if (userRows.length > 0) {
        req.user = userRows[0];
        req.family = {
          id: userRows[0].family_id,
          name: userRows[0].family_name,
          family_code: userRows[0].family_code,
          is_active: userRows[0].family_active
        };
      }
    } else if (decoded.familyId) {
      // Family token
      const [familyRows] = await db.query(
        'SELECT id, name, family_code, is_active FROM families WHERE id = ? AND is_active = TRUE',
        [decoded.familyId]
      );
      
      if (familyRows.length > 0) {
        req.family = familyRows[0];
      }
    } else if (decoded.adminId) {
      // Admin token
      const [adminRows] = await db.query(
        'SELECT id, username, email FROM admin_users WHERE id = ?',
        [decoded.adminId]
      );
      
      if (adminRows.length > 0) {
        req.admin = adminRows[0];
      }
    }
    
    next();
  } catch (error) {
    // Ignore auth errors in optional auth
    next();
  }
};

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  authenticateAdmin,
  authenticateFamily,
  authenticateUser,
  requireParent,
  requireChild,
  optionalAuth
};
