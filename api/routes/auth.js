const express = require('express');
const { body, validationResult } = require('express-validator');
const { generateToken } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Family login with family code
router.post('/family/login', [
  body('family_code').trim().isLength({ min: 3 }).withMessage('Family code must be at least 3 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { family_code } = req.body;

    // Find family by code
    const [familyRows] = await db.query(
      'SELECT id, name, family_code, admin_email, is_active FROM families WHERE family_code = ? AND is_active = TRUE',
      [family_code.toUpperCase()]
    );

    if (familyRows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid family code'
      });
    }

    const family = familyRows[0];

    // Get family members
    const [members] = await db.query(
      'SELECT id, name, role, email, earnings FROM users WHERE family_id = ? AND is_active = TRUE ORDER BY role, name',
      [family.id]
    );

    // Generate family token
    const token = generateToken({ familyId: family.id }, '7d');

    res.json({
      message: 'Family login successful',
      token,
      family: {
        id: family.id,
        name: family.name,
        family_code: family.family_code,
        admin_email: family.admin_email
      },
      members
    });
  } catch (error) {
    console.error('Family login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed'
    });
  }
});

// User login (select user from family)
router.post('/user/login', [
  body('family_code').trim().isLength({ min: 3 }).withMessage('Family code required'),
  body('user_id').isInt({ min: 1 }).withMessage('Valid user ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { family_code, user_id } = req.body;

    // Verify family and user
    const [userRows] = await db.query(
      `SELECT 
        u.id, u.family_id, u.name, u.role, u.email, u.earnings, u.is_active,
        f.name as family_name, f.family_code, f.is_active as family_active
       FROM users u
       JOIN families f ON u.family_id = f.id
       WHERE u.id = ? AND f.family_code = ? AND u.is_active = TRUE AND f.is_active = TRUE`,
      [user_id, family_code.toUpperCase()]
    );

    if (userRows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid user or family code'
      });
    }

    const user = userRows[0];

    // Generate user token
    const token = generateToken({ userId: user.id, familyId: user.family_id }, '7d');

    res.json({
      message: 'User login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        earnings: user.earnings,
        family_id: user.family_id,
        family_name: user.family_name,
        family_code: user.family_code
      }
    });
  } catch (error) {
    console.error('User login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed'
    });
  }
});

// Quick user selection (for existing family sessions)
router.post('/user/select', [
  body('user_id').isInt({ min: 1 }).withMessage('Valid user ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { user_id } = req.body;

    // Get user details
    const [userRows] = await db.query(
      `SELECT 
        u.id, u.family_id, u.name, u.role, u.email, u.earnings, u.is_active,
        f.name as family_name, f.family_code, f.is_active as family_active
       FROM users u
       JOIN families f ON u.family_id = f.id
       WHERE u.id = ? AND u.is_active = TRUE AND f.is_active = TRUE`,
      [user_id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found or inactive'
      });
    }

    const user = userRows[0];

    // Generate user token
    const token = generateToken({ userId: user.id, familyId: user.family_id }, '7d');

    res.json({
      message: 'User selected successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        earnings: user.earnings,
        family_id: user.family_id,
        family_name: user.family_name,
        family_code: user.family_code
      }
    });
  } catch (error) {
    console.error('User select error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'User selection failed'
    });
  }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'FamilyChoresJWT2025SecretKey!';
    
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.adminId) {
      // Admin token
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

      return res.json({
        valid: true,
        type: 'admin',
        admin: adminRows[0]
      });
    } else if (decoded.userId) {
      // User token
      const [userRows] = await db.query(
        `SELECT 
          u.id, u.family_id, u.name, u.role, u.email, u.earnings, u.is_active,
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

      const user = userRows[0];

      return res.json({
        valid: true,
        type: 'user',
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email,
          earnings: user.earnings,
          family_id: user.family_id,
          family_name: user.family_name,
          family_code: user.family_code
        }
      });
    } else if (decoded.familyId) {
      // Family token
      const [familyRows] = await db.query(
        'SELECT id, name, family_code, admin_email, is_active FROM families WHERE id = ? AND is_active = TRUE',
        [decoded.familyId]
      );

      if (familyRows.length === 0) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid family token'
        });
      }

      return res.json({
        valid: true,
        type: 'family',
        family: familyRows[0]
      });
    } else {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token format'
      });
    }
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

    console.error('Token verification error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Token verification failed'
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'FamilyChoresJWT2025SecretKey!';
    
    // Verify current token (even if expired)
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

    // Generate new token with same payload
    const newToken = generateToken({
      adminId: decoded.adminId,
      userId: decoded.userId,
      familyId: decoded.familyId
    }, '7d');

    res.json({
      message: 'Token refreshed successfully',
      token: newToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token refresh failed'
    });
  }
});

module.exports = router;
