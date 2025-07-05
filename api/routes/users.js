const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateUser, requireParent } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Get user profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    // Get updated user data with earnings
    const [userRows] = await db.query(
      `SELECT 
        u.id, u.family_id, u.name, u.role, u.email, u.earnings, u.created_at,
        f.name as family_name, f.family_code
       FROM users u
       JOIN families f ON u.family_id = f.id
       WHERE u.id = ? AND u.is_active = TRUE AND f.is_active = TRUE`,
      [req.user.id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    const user = userRows[0];

    // Get user's completed tasks
    const [completedTasks] = await db.query(
      `SELECT 
        ct.id,
        ct.reward_earned,
        ct.completed_at,
        c.title as chore_title,
        c.description as chore_description
       FROM completed_tasks ct
       JOIN chores c ON ct.chore_id = c.id
       WHERE ct.user_id = ?
       ORDER BY ct.completed_at DESC
       LIMIT 10`,
      [req.user.id]
    );

    // Get user's current chores
    const [currentChores] = await db.query(
      `SELECT 
        c.id,
        c.title,
        c.description,
        c.reward_type,
        c.current_reward,
        c.status,
        c.requires_photo,
        c.assignment_start_time,
        c.completion_start_time,
        c.acceptance_timer,
        c.completion_timer_enabled,
        c.completion_timer_duration
       FROM chores c
       WHERE c.current_assignee = ? 
       AND c.status IN ('pending_acceptance', 'assigned', 'auto_accepted')
       ORDER BY c.assignment_start_time DESC`,
      [req.user.id]
    );

    res.json({
      user,
      completed_tasks: completedTasks,
      current_chores: currentChores,
      stats: {
        total_earnings: user.earnings,
        completed_count: completedTasks.length,
        current_chores_count: currentChores.length
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user profile'
    });
  }
});

// Update user profile
router.put('/profile', authenticateUser, [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
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

    const updates = req.body;
    const userId = req.user.id;

    // Build update query
    const updateFields = [];
    const updateValues = [];

    Object.keys(updates).forEach(key => {
      if (['name', 'email'].includes(key)) {
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

    // Check if name already exists in family (if updating name)
    if (updates.name) {
      const [existingUser] = await db.query(
        'SELECT id FROM users WHERE family_id = ? AND name = ? AND id != ? AND is_active = TRUE',
        [req.user.family_id, updates.name, userId]
      );

      if (existingUser.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'A family member with this name already exists'
        });
      }
    }

    updateValues.push(userId);

    await db.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Get updated user
    const [updatedUser] = await db.query(
      `SELECT 
        u.id, u.family_id, u.name, u.role, u.email, u.earnings, u.created_at,
        f.name as family_name, f.family_code
       FROM users u
       JOIN families f ON u.family_id = f.id
       WHERE u.id = ?`,
      [userId]
    );

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser[0]
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update profile'
    });
  }
});

// Get user's chores
router.get('/chores', authenticateUser, async (req, res) => {
  try {
    const status = req.query.status;
    let whereClause = 'WHERE c.current_assignee = ?';
    const queryParams = [req.user.id];

    if (status) {
      whereClause += ' AND c.status = ?';
      queryParams.push(status);
    }

    const [chores] = await db.query(
      `SELECT 
        c.id,
        c.title,
        c.description,
        c.reward_type,
        c.current_reward,
        c.original_reward,
        c.status,
        c.requires_photo,
        c.assignment_start_time,
        c.completion_start_time,
        c.acceptance_timer,
        c.completion_timer_enabled,
        c.completion_timer_duration,
        c.completion_timer_penalty,
        c.created_at,
        u.name as created_by_name
       FROM chores c
       LEFT JOIN users u ON c.created_by = u.id
       ${whereClause}
       ORDER BY c.assignment_start_time DESC`,
      queryParams
    );

    res.json({
      chores,
      total: chores.length
    });
  } catch (error) {
    console.error('Get user chores error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user chores'
    });
  }
});

// Get user's earnings history
router.get('/earnings', authenticateUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Get total count
    const [countResult] = await db.query(
      'SELECT COUNT(*) as total FROM completed_tasks WHERE user_id = ?',
      [req.user.id]
    );

    const total = countResult[0].total;

    // Get earnings history
    const [earnings] = await db.query(
      `SELECT 
        ct.id,
        ct.reward_earned,
        ct.completed_at,
        c.title as chore_title,
        c.description as chore_description,
        c.reward_type,
        u.name as approved_by_name
       FROM completed_tasks ct
       JOIN chores c ON ct.chore_id = c.id
       LEFT JOIN users u ON ct.approved_by = u.id
       WHERE ct.user_id = ?
       ORDER BY ct.completed_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );

    // Get earnings summary
    const [summary] = await db.query(
      `SELECT 
        COUNT(*) as total_tasks,
        SUM(reward_earned) as total_earnings,
        AVG(reward_earned) as avg_reward,
        MAX(reward_earned) as max_reward,
        MIN(reward_earned) as min_reward
       FROM completed_tasks
       WHERE user_id = ?`,
      [req.user.id]
    );

    res.json({
      earnings,
      summary: summary[0],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get user earnings error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get earnings history'
    });
  }
});

// Get family members (for user to see)
router.get('/family/members', authenticateUser, async (req, res) => {
  try {
    const [members] = await db.query(
      `SELECT 
        u.id,
        u.name,
        u.role,
        u.earnings,
        u.created_at,
        COUNT(ct.id) as completed_tasks,
        COALESCE(SUM(ct.reward_earned), 0) as total_earned
       FROM users u
       LEFT JOIN completed_tasks ct ON u.id = ct.user_id
       WHERE u.family_id = ? AND u.is_active = TRUE
       GROUP BY u.id, u.name, u.role, u.earnings, u.created_at
       ORDER BY u.role, u.name`,
      [req.user.family_id]
    );

    res.json({
      members,
      family: {
        id: req.family.id,
        name: req.family.name,
        family_code: req.family.family_code
      }
    });
  } catch (error) {
    console.error('Get family members error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get family members'
    });
  }
});

// Get user statistics
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    // Get basic stats
    const [basicStats] = await db.query(
      `SELECT 
        COUNT(DISTINCT ct.id) as total_completed,
        COALESCE(SUM(ct.reward_earned), 0) as total_earnings,
        COALESCE(AVG(ct.reward_earned), 0) as avg_reward,
        COUNT(DISTINCT c.id) as current_chores
       FROM users u
       LEFT JOIN completed_tasks ct ON u.id = ct.user_id
       LEFT JOIN chores c ON u.id = c.current_assignee AND c.status IN ('pending_acceptance', 'assigned', 'auto_accepted')
       WHERE u.id = ?`,
      [req.user.id]
    );

    // Get monthly earnings
    const [monthlyEarnings] = await db.query(
      `SELECT 
        DATE_FORMAT(ct.completed_at, '%Y-%m') as month,
        COUNT(*) as tasks_completed,
        SUM(ct.reward_earned) as earnings
       FROM completed_tasks ct
       WHERE ct.user_id = ?
       AND ct.completed_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(ct.completed_at, '%Y-%m')
       ORDER BY month DESC`,
      [req.user.id]
    );

    // Get chore type breakdown
    const [choreTypes] = await db.query(
      `SELECT 
        c.reward_type,
        COUNT(*) as count,
        SUM(ct.reward_earned) as total_earned
       FROM completed_tasks ct
       JOIN chores c ON ct.chore_id = c.id
       WHERE ct.user_id = ?
       GROUP BY c.reward_type`,
      [req.user.id]
    );

    // Get recent activity
    const [recentActivity] = await db.query(
      `SELECT 
        'completed' as activity_type,
        ct.completed_at as activity_date,
        c.title as chore_title,
        ct.reward_earned as reward
       FROM completed_tasks ct
       JOIN chores c ON ct.chore_id = c.id
       WHERE ct.user_id = ?
       ORDER BY ct.completed_at DESC
       LIMIT 10`,
      [req.user.id]
    );

    res.json({
      basic_stats: basicStats[0],
      monthly_earnings: monthlyEarnings,
      chore_types: choreTypes,
      recent_activity: recentActivity
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user statistics'
    });
  }
});

// Get leaderboard (family rankings)
router.get('/leaderboard', authenticateUser, async (req, res) => {
  try {
    const period = req.query.period || 'all'; // all, month, week
    let dateFilter = '';
    
    if (period === 'month') {
      dateFilter = 'AND ct.completed_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
    } else if (period === 'week') {
      dateFilter = 'AND ct.completed_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
    }

    const [leaderboard] = await db.query(
      `SELECT 
        u.id,
        u.name,
        u.role,
        COUNT(ct.id) as tasks_completed,
        COALESCE(SUM(ct.reward_earned), 0) as total_earnings,
        RANK() OVER (ORDER BY COALESCE(SUM(ct.reward_earned), 0) DESC) as rank_by_earnings,
        RANK() OVER (ORDER BY COUNT(ct.id) DESC) as rank_by_tasks
       FROM users u
       LEFT JOIN completed_tasks ct ON u.id = ct.user_id ${dateFilter}
       WHERE u.family_id = ? AND u.is_active = TRUE
       GROUP BY u.id, u.name, u.role
       ORDER BY total_earnings DESC, tasks_completed DESC`,
      [req.user.family_id]
    );

    // Find current user's position
    const userPosition = leaderboard.findIndex(member => member.id === req.user.id) + 1;

    res.json({
      leaderboard,
      period,
      user_position: userPosition,
      total_members: leaderboard.length
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get leaderboard'
    });
  }
});

// Update user earnings (admin/parent only)
router.put('/:user_id/earnings', authenticateUser, requireParent, [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('reason').optional().trim().isLength({ min: 1 }).withMessage('Reason cannot be empty if provided')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const userId = req.params.user_id;
    const { amount, reason } = req.body;

    // Verify user exists in same family
    const [userRows] = await db.query(
      'SELECT id, name, earnings FROM users WHERE id = ? AND family_id = ? AND is_active = TRUE',
      [userId, req.user.family_id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found in your family'
      });
    }

    const user = userRows[0];
    const newEarnings = parseFloat(user.earnings) + parseFloat(amount);

    // Update earnings
    await db.query(
      'UPDATE users SET earnings = ? WHERE id = ?',
      [newEarnings, userId]
    );

    // Log the adjustment (you could create an earnings_adjustments table for this)
    // For now, we'll just return the result

    res.json({
      message: 'Earnings updated successfully',
      user: {
        id: user.id,
        name: user.name,
        previous_earnings: user.earnings,
        adjustment: amount,
        new_earnings: newEarnings,
        reason: reason || 'Manual adjustment'
      }
    });
  } catch (error) {
    console.error('Update user earnings error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update earnings'
    });
  }
});

module.exports = router;
