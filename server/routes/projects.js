// server/routes/projects.js
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const authenticateToken = require('../middleware/auth');

// Get all projects for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const includeCount = req.query.includeCount === 'true';
    const includeArchived = req.query.includeArchived === 'true';

    // Validate limit and offset
    const validLimit = Math.min(Math.max(1, limit), 100); // Between 1 and 100
    const validOffset = Math.max(0, offset);

    // Fetch limit + 1 to determine if there are more pages without COUNT query
    const fetchLimit = validLimit + 1;

    // Build query with optional archived filter
    let query = 'SELECT * FROM projects WHERE user_id = $1';
    if (!includeArchived) {
      query += ' AND (archived IS NULL OR archived = FALSE)';
    }
    query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';

    const result = await pool.query(
      query,
      [req.userId, fetchLimit, validOffset]
    );

    // Determine hasMore by checking if we got more records than requested
    const hasMore = result.rows.length > validLimit;

    // Return only the requested number of records (slice off the extra one)
    const data = result.rows.slice(0, validLimit);

    // Only run COUNT query if explicitly requested
    let total = null;
    if (includeCount) {
      let countQuery = 'SELECT COUNT(*) FROM projects WHERE user_id = $1';
      if (!includeArchived) {
        countQuery += ' AND (archived IS NULL OR archived = FALSE)';
      }
      const countResult = await pool.query(countQuery, [req.userId]);
      total = parseInt(countResult.rows[0].count);
    }

    res.json({
      data,
      pagination: {
        total,
        limit: validLimit,
        offset: validOffset,
        hasMore
      }
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single project by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new project
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = await pool.query(
      'INSERT INTO projects (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, name.trim(), description?.trim() || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a project
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = await pool.query(
      'UPDATE projects SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING *',
      [name.trim(), description?.trim() || null, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Archive a project
router.post('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE projects SET archived = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error archiving project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unarchive (restore) a project
router.post('/:id/unarchive', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE projects SET archived = FALSE, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error unarchiving project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a project (permanent deletion)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

