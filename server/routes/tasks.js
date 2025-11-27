// server/routes/tasks.js
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const authenticateToken = require('../middleware/auth');

// Get all tasks for a project
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    // First verify the project belongs to the user
    const projectCheck = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.projectId, req.userId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await pool.query(
      'SELECT * FROM tasks WHERE project_id = $1 AND user_id = $2 ORDER BY created_at DESC',
      [req.params.projectId, req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single task by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new task
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { project_id, title, description, status, due_date, priority } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Task title is required' });
    }

    // Verify the project belongs to the user
    const projectCheck = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [project_id, req.userId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const validStatus = status && ['todo', 'in_progress', 'done'].includes(status) 
      ? status 
      : 'todo';

    const validPriority = priority && ['low', 'medium', 'high'].includes(priority)
      ? priority
      : 'medium';

    const result = await pool.query(
      'INSERT INTO tasks (project_id, user_id, title, description, status, due_date, priority) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [project_id, req.userId, title.trim(), description?.trim() || null, validStatus, due_date || null, validPriority]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a task
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('Received Update Payload:', req.body);

    // Verify task exists and belongs to user
    const existingTask = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (existingTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { title, description, status, due_date, priority, prevPosition, nextPosition } = req.body;

    // Prepare values: use provided value if present, otherwise null (COALESCE will use existing)
    let updatedTitle = null;
    let updatedDescription = null;
    let updatedStatus = null;
    let updatedDueDate = null;
    let updatedPriority = null;
    let updatedPosition = null;

    if (title !== undefined) {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return res.status(400).json({ error: 'Task title cannot be empty' });
      }
      updatedTitle = trimmedTitle;
    }

    if (description !== undefined) {
      updatedDescription = description?.trim() || null;
    }

    if (status !== undefined) {
      if (['todo', 'in_progress', 'done'].includes(status)) {
        updatedStatus = status;
      } else {
        return res.status(400).json({ error: 'Invalid status value' });
      }
    }

    if (due_date !== undefined) {
      updatedDueDate = due_date || null;
    }

    if (priority !== undefined) {
      if (['low', 'medium', 'high'].includes(priority)) {
        updatedPriority = priority;
      } else {
        return res.status(400).json({ error: 'Invalid priority value. Must be low, medium, or high' });
      }
    }

    // Handle fractional indexing for position updates
    if (prevPosition !== undefined || nextPosition !== undefined) {
      let newPosition;
      
      if (prevPosition === null && nextPosition === null) {
        // Empty column - set to default starting position
        newPosition = 10000;
      } else if (prevPosition === null) {
        // Dropped at the top: new position = nextPosition / 2
        newPosition = nextPosition / 2;
      } else if (nextPosition === null) {
        // Dropped at the bottom: new position = prevPosition + 10000
        newPosition = prevPosition + 10000;
      } else {
        // Dropped between two tasks: new position = (prevPosition + nextPosition) / 2
        newPosition = (prevPosition + nextPosition) / 2;
      }
      
      updatedPosition = newPosition;
    } else if (req.body.position !== undefined) {
      // Fallback: direct position assignment (for backward compatibility)
      updatedPosition = req.body.position;
    }

    const queryText = `
      UPDATE tasks 
      SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        due_date = COALESCE($4, due_date),
        priority = COALESCE($5, priority),
        position = COALESCE($6, position),
        updated_at = NOW()
      WHERE id = $7 AND user_id = $8
      RETURNING *
    `;

    const values = [
      updatedTitle,
      updatedDescription,
      updatedStatus,
      updatedDueDate,
      updatedPriority,
      updatedPosition,
      req.params.id,
      req.userId
    ];

    console.log('Executing SQL:', queryText.trim());
    console.log('With Values:', values);

    const result = await pool.query(queryText, values);

    console.log('Update Result:', result.rows[0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a task
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

