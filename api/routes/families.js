const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateFamily, authenticateUser, requireParent } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Register new family (public endpoint)
router.post('/register', [
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
      const existing = await db.query(
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
    const result = await db.query(
      'INSERT INTO families (name, family_code, admin_email) VALUES (?, ?, ?)',
      [name, family_code, admin_email]
    );

    const familyId = result.insertId;

    // Get created family
    const familyRows = await db.query(
      'SELECT id, name, family_code, admin_email, created_at FROM families WHERE id = ?',
      [familyId]
    );

    res.status(201).json({
      message: 'Family registered successfully',
      family: familyRows[0],
      instructions: {
        step1: 'Share your family code with family members',
        step2: 'Add family members using the family dashboard',
        step3: 'Start creating chores and assigning them'
      }
    });
  } catch (error) {
    console.error('Family registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register family'
    });
  }
});

// Get family info by code (public endpoint for verification)
router.get('/code/:family_code', async (req, res) => {
  try {
    const family_code = req.params.family_code.toUpperCase();

    const familyRows = await db.query(
      'SELECT id, name, family_code, created_at FROM families WHERE family_code = ? AND is_active = TRUE',
      [family_code]
    );

    if (familyRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Family code not found'
      });
    }

    // Get member count (without revealing names)
    const memberCount = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE family_id = ? AND is_active = TRUE',
      [familyRows[0].id]
    );

    res.json({
      family: {
        name: familyRows[0].name,
        family_code: familyRows[0].family_code,
        created_at: familyRows[0].created_at,
        member_count: memberCount[0].count
      }
    });
  } catch (error) {
    console.error('Get family by code error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get family info'
    });
  }
});

// Get family details (requires family authentication)
router.get('/:id', authenticateFamily, async (req, res) => {
  try {
    const familyId = req.params.id;

    // Verify user has access to this family
    if (req.family.id !== parseInt(familyId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this family'
      });
    }

    // Get family members
    const [members] = await db.query(
      'SELECT id, name, role, email, earnings, created_at FROM users WHERE family_id = ? AND is_active = TRUE ORDER BY role, name',
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
       LEFT JOIN completed_tasks ct ON c.id = ct.chore_id
       WHERE f.id = ?`,
      [familyId]
    );

    res.json({
      family: req.family,
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

// Add family member (requires user authentication and parent role)
router.post('/:id/members', authenticateUser, requireParent, [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('role').isIn(['parent', 'child']).withMessage('Role must be parent or child'),
  body('email').optional().isEmail().withMessage('Valid email required if provided')
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
    const { name, role, email } = req.body;

    // Verify user has access to this family
    if (req.user.family_id !== parseInt(familyId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this family'
      });
    }

    // Check if name already exists in family
    const [existingUser] = await db.query(
      'SELECT id FROM users WHERE family_id = ? AND name = ? AND is_active = TRUE',
      [familyId, name]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A family member with this name already exists'
      });
    }

    // Add family member
    const [result] = await db.query(
      'INSERT INTO users (family_id, name, role, email) VALUES (?, ?, ?, ?)',
      [familyId, name, role, email || null]
    );

    const userId = result.insertId;

    // Get created user
    const [userRows] = await db.query(
      'SELECT id, name, role, email, earnings, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.status(201).json({
      message: 'Family member added successfully',
      member: userRows[0]
    });
  } catch (error) {
    console.error('Add family member error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add family member'
    });
  }
});

// Update family member (requires user authentication and parent role)
router.put('/:id/members/:user_id', authenticateUser, requireParent, [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('role').optional().isIn(['parent', 'child']).withMessage('Role must be parent or child'),
  body('email').optional().isEmail().withMessage('Valid email required if provided'),
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
    const userId = req.params.user_id;
    const updates = req.body;

    // Verify user has access to this family
    if (req.user.family_id !== parseInt(familyId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this family'
      });
    }

    // Check if user exists in family
    const [userRows] = await db.query(
      'SELECT id, name FROM users WHERE id = ? AND family_id = ?',
      [userId, familyId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Family member not found'
      });
    }

    // Prevent user from deactivating themselves
    if (parseInt(userId) === req.user.id && updates.is_active === false) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot deactivate your own account'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    Object.keys(updates).forEach(key => {
      if (['name', 'role', 'email', 'is_active'].includes(key)) {
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

    updateValues.push(userId);

    await db.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Get updated user
    const [updatedUser] = await db.query(
      'SELECT id, name, role, email, earnings, is_active, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      message: 'Family member updated successfully',
      member: updatedUser[0]
    });
  } catch (error) {
    console.error('Update family member error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update family member'
    });
  }
});

// Remove family member (requires user authentication and parent role)
router.delete('/:id/members/:user_id', authenticateUser, requireParent, async (req, res) => {
  try {
    const familyId = req.params.id;
    const userId = req.params.user_id;

    // Verify user has access to this family
    if (req.user.family_id !== parseInt(familyId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this family'
      });
    }

    // Check if user exists in family
    const [userRows] = await db.query(
      'SELECT id, name, role FROM users WHERE id = ? AND family_id = ?',
      [userId, familyId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Family member not found'
      });
    }

    // Prevent user from removing themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot remove your own account'
      });
    }

    // Soft delete (deactivate) instead of hard delete to preserve data integrity
    await db.query(
      'UPDATE users SET is_active = FALSE WHERE id = ?',
      [userId]
    );

    res.json({
      message: 'Family member removed successfully',
      member: userRows[0]
    });
  } catch (error) {
    console.error('Remove family member error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to remove family member'
    });
  }
});

// Get family settings
router.get('/:id/settings', authenticateUser, requireParent, async (req, res) => {
  try {
    const familyId = req.params.id;

    // Verify user has access to this family
    if (req.user.family_id !== parseInt(familyId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this family'
      });
    }

    const [settings] = await db.query(
      'SELECT setting_key, setting_value FROM family_settings WHERE family_id = ?',
      [familyId]
    );

    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.setting_key] = setting.setting_value;
    });

    res.json({
      settings: settingsObj
    });
  } catch (error) {
    console.error('Get family settings error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get family settings'
    });
  }
});

// Update family settings
router.put('/:id/settings', authenticateUser, requireParent, [
  body('settings').isObject().withMessage('Settings must be an object')
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
    const { settings } = req.body;

    // Verify user has access to this family
    if (req.user.family_id !== parseInt(familyId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this family'
      });
    }

    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      await db.query(
        `INSERT INTO family_settings (family_id, setting_key, setting_value) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [familyId, key, JSON.stringify(value)]
      );
    }

    res.json({
      message: 'Family settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Update family settings error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update family settings'
    });
  }
});

module.exports = router;
