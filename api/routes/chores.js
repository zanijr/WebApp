const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateUser, requireParent, requireChild } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');

const router = express.Router();

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/chore-photos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `chore-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get all chores for family
router.get('/', authenticateUser, async (req, res) => {
  try {
    const status = req.query.status;
    const assignee = req.query.assignee;
    
    let whereClause = 'WHERE c.family_id = ?';
    const queryParams = [req.user.family_id];

    if (status) {
      whereClause += ' AND c.status = ?';
      queryParams.push(status);
    }

    if (assignee) {
      whereClause += ' AND c.current_assignee = ?';
      queryParams.push(assignee);
    }

    const [chores] = await db.query(
      `SELECT 
        c.*,
        u1.name as created_by_name,
        u2.name as assignee_name,
        COUNT(DISTINCT cs.id) as submission_count,
        COUNT(DISTINCT ct.id) as completion_count
       FROM chores c
       LEFT JOIN users u1 ON c.created_by = u1.id
       LEFT JOIN users u2 ON c.current_assignee = u2.id
       LEFT JOIN chore_submissions cs ON c.id = cs.chore_id
       LEFT JOIN completed_tasks ct ON c.id = ct.chore_id
       ${whereClause}
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      queryParams
    );

    res.json({
      chores,
      total: chores.length
    });
  } catch (error) {
    console.error('Get chores error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get chores'
    });
  }
});

// Create new chore (parents only)
router.post('/', authenticateUser, requireParent, [
  body('title').trim().isLength({ min: 2 }).withMessage('Title must be at least 2 characters'),
  body('description').optional().trim(),
  body('reward_type').isIn(['money', 'screen_time']).withMessage('Reward type must be money or screen_time'),
  body('reward_amount').isFloat({ min: 0 }).withMessage('Reward amount must be a positive number'),
  body('requires_photo').optional().isBoolean(),
  body('acceptance_timer').optional().isInt({ min: 1, max: 60 }).withMessage('Acceptance timer must be 1-60 minutes'),
  body('completion_timer_enabled').optional().isBoolean(),
  body('completion_timer_duration').optional().isInt({ min: 1 }).withMessage('Completion timer must be positive'),
  body('completion_timer_penalty').optional().isFloat({ min: 0 }).withMessage('Penalty must be non-negative'),
  body('reduction_enabled').optional().isBoolean(),
  body('reduction_amount').optional().isFloat({ min: 0 }).withMessage('Reduction amount must be non-negative')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const {
      title,
      description,
      reward_type,
      reward_amount,
      requires_photo = false,
      acceptance_timer = 5,
      completion_timer_enabled = false,
      completion_timer_duration = 0,
      completion_timer_penalty = 0,
      reduction_enabled = false,
      reduction_amount = 0
    } = req.body;

    // Create chore
    const [result] = await db.query(
      `INSERT INTO chores (
        family_id, title, description, reward_type, reward_amount, 
        original_reward, current_reward, requires_photo, created_by,
        acceptance_timer, completion_timer_enabled, completion_timer_duration,
        completion_timer_penalty, reduction_enabled, reduction_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.family_id, title, description, reward_type, reward_amount,
        reward_amount, reward_amount, requires_photo, req.user.id,
        acceptance_timer, completion_timer_enabled, completion_timer_duration,
        completion_timer_penalty, reduction_enabled, reduction_amount
      ]
    );

    const choreId = result.insertId;

    // Get created chore
    const [choreRows] = await db.query(
      `SELECT 
        c.*,
        u.name as created_by_name
       FROM chores c
       JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [choreId]
    );

    res.status(201).json({
      message: 'Chore created successfully',
      chore: choreRows[0]
    });
  } catch (error) {
    console.error('Create chore error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create chore'
    });
  }
});

// Get chore details
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const choreId = req.params.id;

    // Get chore details
    const [choreRows] = await db.query(
      `SELECT 
        c.*,
        u1.name as created_by_name,
        u2.name as assignee_name
       FROM chores c
       LEFT JOIN users u1 ON c.created_by = u1.id
       LEFT JOIN users u2 ON c.current_assignee = u2.id
       WHERE c.id = ? AND c.family_id = ?`,
      [choreId, req.user.family_id]
    );

    if (choreRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Chore not found'
      });
    }

    const chore = choreRows[0];

    // Get chore submissions
    const [submissions] = await db.query(
      `SELECT 
        cs.*,
        u1.name as submitted_by_name,
        u2.name as reviewed_by_name
       FROM chore_submissions cs
       JOIN users u1 ON cs.user_id = u1.id
       LEFT JOIN users u2 ON cs.reviewed_by = u2.id
       WHERE cs.chore_id = ?
       ORDER BY cs.submitted_at DESC`,
      [choreId]
    );

    // Get completion history
    const [completions] = await db.query(
      `SELECT 
        ct.*,
        u1.name as completed_by_name,
        u2.name as approved_by_name
       FROM completed_tasks ct
       JOIN users u1 ON ct.user_id = u1.id
       LEFT JOIN users u2 ON ct.approved_by = u2.id
       WHERE ct.chore_id = ?
       ORDER BY ct.completed_at DESC`,
      [choreId]
    );

    res.json({
      chore,
      submissions,
      completions
    });
  } catch (error) {
    console.error('Get chore details error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get chore details'
    });
  }
});

// Start chore assignment (parents only)
router.post('/:id/assign', authenticateUser, requireParent, async (req, res) => {
  try {
    const choreId = req.params.id;

    // Get chore and verify it's available
    const [choreRows] = await db.query(
      'SELECT * FROM chores WHERE id = ? AND family_id = ? AND status = "available"',
      [choreId, req.user.family_id]
    );

    if (choreRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Available chore not found'
      });
    }

    // Get family's last assigned child index
    const [familyRows] = await db.query(
      'SELECT last_assigned_child_index FROM families WHERE id = ?',
      [req.user.family_id]
    );

    const lastIndex = familyRows[0].last_assigned_child_index;

    // Get children in family
    const [children] = await db.query(
      'SELECT id, name FROM users WHERE family_id = ? AND role = "child" AND is_active = TRUE ORDER BY id',
      [req.user.family_id]
    );

    if (children.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No children available for assignment'
      });
    }

    // Calculate next child
    const nextIndex = (lastIndex + 1) % children.length;
    const nextChild = children[nextIndex];

    // Update chore assignment
    await db.query(
      `UPDATE chores SET 
        current_assignee = ?,
        first_assignee_id = ?,
        assignment_start_time = ?,
        status = 'pending_acceptance',
        current_reward = original_reward
       WHERE id = ?`,
      [nextChild.id, nextChild.id, Date.now(), choreId]
    );

    // Update family's last assigned child index
    await db.query(
      'UPDATE families SET last_assigned_child_index = ? WHERE id = ?',
      [nextIndex, req.user.family_id]
    );

    // Create assignment record
    await db.query(
      'INSERT INTO chore_assignments (chore_id, user_id, status) VALUES (?, ?, "pending")',
      [choreId, nextChild.id]
    );

    res.json({
      message: 'Chore assigned successfully',
      assigned_to: nextChild.name,
      chore_id: choreId
    });
  } catch (error) {
    console.error('Assign chore error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to assign chore'
    });
  }
});

// Accept chore (children only)
router.post('/:id/accept', authenticateUser, requireChild, async (req, res) => {
  try {
    const choreId = req.params.id;

    // Verify chore is assigned to this user
    const [choreRows] = await db.query(
      `SELECT * FROM chores 
       WHERE id = ? AND family_id = ? AND current_assignee = ? 
       AND status = 'pending_acceptance'`,
      [choreId, req.user.family_id, req.user.id]
    );

    if (choreRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No pending chore assignment found'
      });
    }

    const chore = choreRows[0];

    // Update chore status
    await db.query(
      `UPDATE chores SET 
        status = 'assigned',
        assignment_start_time = NULL,
        completion_start_time = ?
       WHERE id = ?`,
      [chore.completion_timer_enabled ? Date.now() : null, choreId]
    );

    // Update assignment record
    await db.query(
      'UPDATE chore_assignments SET status = "accepted", responded_at = NOW() WHERE chore_id = ? AND user_id = ? AND status = "pending"',
      [choreId, req.user.id]
    );

    res.json({
      message: 'Chore accepted successfully',
      chore_id: choreId
    });
  } catch (error) {
    console.error('Accept chore error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to accept chore'
    });
  }
});

// Decline chore (children only)
router.post('/:id/decline', authenticateUser, requireChild, async (req, res) => {
  try {
    const choreId = req.params.id;

    // Verify chore is assigned to this user
    const [choreRows] = await db.query(
      `SELECT * FROM chores 
       WHERE id = ? AND family_id = ? AND current_assignee = ? 
       AND status = 'pending_acceptance'`,
      [choreId, req.user.family_id, req.user.id]
    );

    if (choreRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No pending chore assignment found'
      });
    }

    // Update assignment record
    await db.query(
      'UPDATE chore_assignments SET status = "declined", responded_at = NOW() WHERE chore_id = ? AND user_id = ? AND status = "pending"',
      [choreId, req.user.id]
    );

    // Assign to next child
    await assignToNextChild(choreId, req.user.family_id);

    res.json({
      message: 'Chore declined and passed to next child',
      chore_id: choreId
    });
  } catch (error) {
    console.error('Decline chore error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to decline chore'
    });
  }
});

// Submit chore completion (children only)
router.post('/:id/submit', authenticateUser, requireChild, upload.single('photo'), [
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const choreId = req.params.id;
    const { notes } = req.body;

    // Verify chore is assigned to this user
    const [choreRows] = await db.query(
      `SELECT * FROM chores 
       WHERE id = ? AND family_id = ? AND current_assignee = ? 
       AND status IN ('assigned', 'auto_accepted')`,
      [choreId, req.user.family_id, req.user.id]
    );

    if (choreRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No assigned chore found'
      });
    }

    const chore = choreRows[0];

    // Check if photo is required
    if (chore.requires_photo && !req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Photo is required for this chore'
      });
    }

    // Get current assignment
    const [assignmentRows] = await db.query(
      'SELECT id FROM chore_assignments WHERE chore_id = ? AND user_id = ? AND status = "accepted" ORDER BY assigned_at DESC LIMIT 1',
      [choreId, req.user.id]
    );

    if (assignmentRows.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No active assignment found'
      });
    }

    const assignmentId = assignmentRows[0].id;

    // Create submission
    const photoUrl = req.file ? `/uploads/chore-photos/${req.file.filename}` : null;
    
    const [submissionResult] = await db.query(
      'INSERT INTO chore_submissions (chore_id, user_id, assignment_id, photo_url, notes) VALUES (?, ?, ?, ?, ?)',
      [choreId, req.user.id, assignmentId, photoUrl, notes]
    );

    // Update chore status
    await db.query(
      'UPDATE chores SET status = "pending_approval", completion_start_time = NULL WHERE id = ?',
      [choreId]
    );

    res.json({
      message: 'Chore submitted for approval',
      submission_id: submissionResult.insertId,
      chore_id: choreId
    });
  } catch (error) {
    console.error('Submit chore error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to submit chore'
    });
  }
});

// Approve chore submission (parents only)
router.post('/:id/approve/:submission_id', authenticateUser, requireParent, async (req, res) => {
  try {
    const choreId = req.params.id;
    const submissionId = req.params.submission_id;

    // Get submission details
    const [submissionRows] = await db.query(
      `SELECT cs.*, c.current_reward, c.reward_type, u.name as user_name
       FROM chore_submissions cs
       JOIN chores c ON cs.chore_id = c.id
       JOIN users u ON cs.user_id = u.id
       WHERE cs.id = ? AND cs.chore_id = ? AND c.family_id = ? AND cs.status = 'pending'`,
      [submissionId, choreId, req.user.family_id]
    );

    if (submissionRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Pending submission not found'
      });
    }

    const submission = submissionRows[0];

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Update submission status
      await db.query(
        'UPDATE chore_submissions SET status = "approved", reviewed_at = NOW(), reviewed_by = ? WHERE id = ?',
        [req.user.id, submissionId]
      );

      // Create completed task record
      await db.query(
        'INSERT INTO completed_tasks (chore_id, user_id, assignment_id, submission_id, reward_earned, approved_by) VALUES (?, ?, ?, ?, ?, ?)',
        [choreId, submission.user_id, submission.assignment_id, submissionId, submission.current_reward, req.user.id]
      );

      // Update assignment status
      await db.query(
        'UPDATE chore_assignments SET status = "completed", completed_at = NOW() WHERE id = ?',
        [submission.assignment_id]
      );

      // Update chore status
      await db.query(
        'UPDATE chores SET status = "available", current_assignee = NULL, first_assignee_id = NULL WHERE id = ?',
        [choreId]
      );

      // Commit transaction
      await db.query('COMMIT');

      res.json({
        message: 'Chore approved and completed',
        reward_earned: submission.current_reward,
        user_name: submission.user_name
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Approve chore error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to approve chore'
    });
  }
});

// Reject chore submission (parents only)
router.post('/:id/reject/:submission_id', authenticateUser, requireParent, [
  body('reason').trim().isLength({ min: 1 }).withMessage('Rejection reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const choreId = req.params.id;
    const submissionId = req.params.submission_id;
    const { reason } = req.body;

    // Get submission details
    const [submissionRows] = await db.query(
      `SELECT cs.*, u.name as user_name
       FROM chore_submissions cs
       JOIN chores c ON cs.chore_id = c.id
       JOIN users u ON cs.user_id = u.id
       WHERE cs.id = ? AND cs.chore_id = ? AND c.family_id = ? AND cs.status = 'pending'`,
      [submissionId, choreId, req.user.family_id]
    );

    if (submissionRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Pending submission not found'
      });
    }

    // Update submission status
    await db.query(
      'UPDATE chore_submissions SET status = "rejected", reviewed_at = NOW(), reviewed_by = ?, rejection_reason = ? WHERE id = ?',
      [req.user.id, reason, submissionId]
    );

    // Update chore status back to assigned
    await db.query(
      'UPDATE chores SET status = "assigned" WHERE id = ?',
      [choreId]
    );

    res.json({
      message: 'Chore submission rejected',
      reason: reason
    });
  } catch (error) {
    console.error('Reject chore error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reject chore'
    });
  }
});

// Helper function to assign chore to next child
async function assignToNextChild(choreId, familyId) {
  // Get chore details
  const [choreRows] = await db.query(
    'SELECT * FROM chores WHERE id = ?',
    [choreId]
  );

  if (choreRows.length === 0) return;

  const chore = choreRows[0];

  // Get children who haven't been assigned this chore yet
  const [availableChildren] = await db.query(
    `SELECT u.id, u.name 
     FROM users u 
     WHERE u.family_id = ? AND u.role = 'child' AND u.is_active = TRUE
     AND u.id NOT IN (
       SELECT ca.user_id 
       FROM chore_assignments ca 
       WHERE ca.chore_id = ? AND ca.status IN ('pending', 'accepted', 'declined')
     )
     ORDER BY u.id`,
    [familyId, choreId]
  );

  if (availableChildren.length > 0) {
    // Assign to next available child
    const nextChild = availableChildren[0];
    
    await db.query(
      `UPDATE chores SET 
        current_assignee = ?,
        assignment_start_time = ?,
        status = 'pending_acceptance'
       WHERE id = ?`,
      [nextChild.id, Date.now(), choreId]
    );

    await db.query(
      'INSERT INTO chore_assignments (chore_id, user_id, status) VALUES (?, ?, "pending")',
      [choreId, nextChild.id]
    );
  } else {
    // All children have been offered, auto-assign to first assignee
    if (chore.first_assignee_id) {
      let newReward = chore.current_reward;
      
      if (chore.reduction_enabled) {
        newReward = Math.max(
          chore.current_reward - chore.reduction_amount,
          Math.ceil(chore.original_reward * 0.1)
        );
      }

      await db.query(
        `UPDATE chores SET 
          current_assignee = ?,
          assignment_start_time = NULL,
          status = 'auto_accepted',
          current_reward = ?,
          completion_start_time = ?
         WHERE id = ?`,
        [
          chore.first_assignee_id, 
          newReward,
          chore.completion_timer_enabled ? Date.now() : null,
          choreId
        ]
      );

      await db.query(
        'INSERT INTO chore_assignments (chore_id, user_id, status, responded_at) VALUES (?, ?, "accepted", NOW())',
        [choreId, chore.first_assignee_id]
      );
    }
  }
}

module.exports = router;
