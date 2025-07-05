const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateAdmin, hashPassword, comparePassword, generateToken } = require('../middleware/auth');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Admin login
router.post('/login', [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { username, password } = req.body;

    // Find admin user
    const [adminRows] = await db.query(
      'SELECT id, username, password_hash, email FROM admin_users WHERE username = ?',
      [username]
    );

    if (adminRows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    const admin = adminRows[0];

    // Verify password
    const isValidPassword = await comparePassword(password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await db.query(
      'UPDATE admin_users SET last_login = NOW() WHERE id = ?',
      [admin.id]
    );

    // Generate token
    const token = generateToken({ adminId: admin.id }, '24h');

    res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed'
    });
  }
});

// Get admin profile
router.get('/profile', authenticateAdmin, async (req, res) => {
  try {
    res.json({
      admin: req.admin
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get profile'
    });
  }
});

// Get all families
router.get('/families', authenticateAdmin, async (req, res) => {
  try {
    const [families] = await db.query(`
      SELECT 
        f.id,
        f.name,
        f.family_code,
        f.admin_email,
        f.created_at,
        f.is_active,
        f.last_assigned_child_index,
        COUNT(DISTINCT u.id) as member_count,
        COUNT(DISTINCT CASE WHEN u.role = 'parent' THEN u.id END) as parent_count,
        COUNT(DISTINCT CASE WHEN u.role = 'child' THEN u.id END) as child_count,
        COUNT(DISTINCT c.id) as chore_count,
        COUNT(DISTINCT CASE WHEN c.status IN ('available', 'pending_acceptance', 'assigned', 'auto_accepted') THEN c.id END) as active_chore_count
      FROM families f
      LEFT JOIN users u ON f.id = u.family_id AND u.is_active = TRUE
      LEFT JOIN chores c ON f.id = c.family_id
      GROUP BY f.id, f.name, f.family_code, f.admin_email, f.created_at, f.is_active, f.last_assigned_child_index
      ORDER BY f.created_at DESC
    `);

    res.json({
      families,
      total: families.length
    });
  } catch (error) {
    console.error('Get families error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get families'
    });
  }
});

// Create new family
router.post('/families', authenticateAdmin, [
  body('name').trim().isLength({ min: 2 }).withMessage('Family name must be at least 2 characters'),
  body('admin_email').isEmail().withMessage('Valid email required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { name, admin_email } = req.body;

    // Generate unique family code
    let family_code;
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      family_code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const [existing] = await db.query(
        'SELECT id FROM families WHERE family_code = ?',
        [family_code]
      );
      isUnique = existing.length === 0;
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to generate unique family code'
      });
    }

    // Create family
    const [result] = await db.query(
      'INSERT INTO families (name, family_code, admin_email) VALUES (?, ?, ?)',
      [name, family_code, admin_email]
    );

    const familyId = result.insertId;

    // Get created family
    const [familyRows] = await db.query(
      'SELECT * FROM families WHERE id = ?',
      [familyId]
    );

    res.status(201).json({
      message: 'Family created successfully',
      family: familyRows[0]
    });
  } catch (error) {
    console.error('Create family error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create family'
    });
  }
});

// Get family details
router.get('/families/:id', authenticateAdmin, async (req, res) => {
  try {
    const familyId = req.params.id;

    // Get family info
    const [familyRows] = await db.query(
      'SELECT * FROM families WHERE id = ?',
      [familyId]
    );

    if (familyRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Family not found'
      });
    }

    // Get family members
    const [members] = await db.query(
      'SELECT id, name, role, email, earnings, created_at, is_active FROM users WHERE family_id = ? ORDER BY role, name',
      [familyId]
    );

    // Get family chores
    const [chores] = await db.query(
      `SELECT 
        c.*,
        u1.name as created_by_name,
        u2.name as assignee_name
       FROM chores c
       LEFT JOIN users u1 ON c.created_by = u1.id
       LEFT JOIN users u2 ON c.current_assignee = u2.id
       WHERE c.family_id = ?
       ORDER BY c.created_at DESC`,
      [familyId]
    );

    // Get family stats
    const [stats] = await db.query(
      `SELECT 
        COUNT(DISTINCT u.id) as total_members,
        COUNT(DISTINCT CASE WHEN u.role = 'parent' THEN u.id END) as parents,
        COUNT(DISTINCT CASE WHEN u.role = 'child' THEN u.id END) as children,
        COUNT(DISTINCT c.id) as total_chores,
        COUNT(DISTINCT CASE WHEN c.status IN ('available', 'pending_acceptance', 'assigned', 'auto_accepted') THEN c.id END) as active_chores,
        COUNT(DISTINCT ct.id) as completed_tasks,
        COALESCE(SUM(ct.reward_earned), 0) as total_rewards_earned
       FROM families f
       LEFT JOIN users u ON f.id = u.family_id AND u.is_active = TRUE
       LEFT JOIN chores c ON f.id = c.family_id
       LEFT JOIN completed_tasks ct ON f.id = (SELECT family_id FROM chores WHERE id = ct.chore_id)
       WHERE f.id = ?`,
      [familyId]
    );

    res.json({
      family: familyRows[0],
      members,
      chores,
      stats: stats[0]
    });
  } catch (error) {
    console.error('Get family details error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get family details'
    });
  }
});

// Update family
router.put('/families/:id', authenticateAdmin, [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Family name must be at least 2 characters'),
  body('admin_email').optional().isEmail().withMessage('Valid email required'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const familyId = req.params.id;
    const updates = req.body;

    // Check if family exists
    const [familyRows] = await db.query(
      'SELECT id FROM families WHERE id = ?',
      [familyId]
    );

    if (familyRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Family not found'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    Object.keys(updates).forEach(key => {
      if (['name', 'admin_email', 'is_active'].includes(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No valid fields to update'
      });
    }

    updateValues.push(familyId);

    await db.query(
      `UPDATE families SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Get updated family
    const [updatedFamily] = await db.query(
      'SELECT * FROM families WHERE id = ?',
      [familyId]
    );

    res.json({
      message: 'Family updated successfully',
      family: updatedFamily[0]
    });
  } catch (error) {
    console.error('Update family error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update family'
    });
  }
});

// Delete family
router.delete('/families/:id', authenticateAdmin, async (req, res) => {
  try {
    const familyId = req.params.id;

    // Check if family exists
    const [familyRows] = await db.query(
      'SELECT id, name FROM families WHERE id = ?',
      [familyId]
    );

    if (familyRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Family not found'
      });
    }

    // Delete family (cascade will handle related records)
    await db.query('DELETE FROM families WHERE id = ?', [familyId]);

    res.json({
      message: 'Family deleted successfully',
      family: familyRows[0]
    });
  } catch (error) {
    console.error('Delete family error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete family'
    });
  }
});

// Get system stats
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT 
        COUNT(DISTINCT f.id) as total_families,
        COUNT(DISTINCT CASE WHEN f.is_active = TRUE THEN f.id END) as active_families,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN u.is_active = TRUE THEN u.id END) as active_users,
        COUNT(DISTINCT CASE WHEN u.role = 'parent' AND u.is_active = TRUE THEN u.id END) as active_parents,
        COUNT(DISTINCT CASE WHEN u.role = 'child' AND u.is_active = TRUE THEN u.id END) as active_children,
        COUNT(DISTINCT c.id) as total_chores,
        COUNT(DISTINCT CASE WHEN c.status IN ('available', 'pending_acceptance', 'assigned', 'auto_accepted') THEN c.id END) as active_chores,
        COUNT(DISTINCT ct.id) as completed_tasks,
        COALESCE(SUM(ct.reward_earned), 0) as total_rewards_earned
      FROM families f
      LEFT JOIN users u ON f.id = u.family_id
      LEFT JOIN chores c ON f.id = c.family_id
      LEFT JOIN completed_tasks ct ON c.id = ct.chore_id
    `);

    // Get recent activity
    const [recentFamilies] = await db.query(
      'SELECT id, name, family_code, created_at FROM families ORDER BY created_at DESC LIMIT 5'
    );

    const [recentTasks] = await db.query(`
      SELECT 
        ct.completed_at,
        ct.reward_earned,
        u.name as user_name,
        c.title as chore_title,
        f.name as family_name
      FROM completed_tasks ct
      JOIN users u ON ct.user_id = u.id
      JOIN chores c ON ct.chore_id = c.id
      JOIN families f ON u.family_id = f.id
      ORDER BY ct.completed_at DESC
      LIMIT 10
    `);

    res.json({
      stats: stats[0],
      recent_families: recentFamilies,
      recent_tasks: recentTasks
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get stats'
    });
  }
});

module.exports = router;
