// server/routes/projects.js
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const authenticateToken = require('../middleware/auth');

const getProjectAccess = async (projectId, userId) => {
  const result = await pool.query(
    `SELECT p.id, p.user_id
     FROM projects p
     LEFT JOIN project_shares ps
       ON ps.project_id = p.id
      AND ps.shared_with_user_id = $2
     WHERE p.id = $1
       AND (p.user_id = $2 OR ps.shared_with_user_id IS NOT NULL)
     LIMIT 1`,
    [projectId, userId]
  );

  if (result.rows.length === 0) {
    return { hasAccess: false, isOwner: false };
  }

  return {
    hasAccess: true,
    isOwner: result.rows[0].user_id === userId
  };
};

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
    let query = `SELECT p.*,
        (p.user_id = $1) AS is_owner
      FROM projects p
      LEFT JOIN project_shares ps
        ON ps.project_id = p.id
       AND ps.shared_with_user_id = $1
      WHERE (p.user_id = $1 OR ps.shared_with_user_id IS NOT NULL)`;
    if (!includeArchived) {
      query += ' AND (p.archived IS NULL OR p.archived = FALSE)';
    }
    query += ' ORDER BY p.created_at DESC LIMIT $2 OFFSET $3';

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
      let countQuery = `SELECT COUNT(DISTINCT p.id)
        FROM projects p
        LEFT JOIN project_shares ps
          ON ps.project_id = p.id
         AND ps.shared_with_user_id = $1
        WHERE (p.user_id = $1 OR ps.shared_with_user_id IS NOT NULL)`;
      if (!includeArchived) {
        countQuery += ' AND (p.archived IS NULL OR p.archived = FALSE)';
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
      `SELECT p.*,
         (p.user_id = $2) AS is_owner
       FROM projects p
       LEFT JOIN project_shares ps
         ON ps.project_id = p.id
        AND ps.shared_with_user_id = $2
       WHERE p.id = $1
         AND (p.user_id = $2 OR ps.shared_with_user_id IS NOT NULL)
       LIMIT 1`,
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

    const access = await getProjectAccess(req.params.id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only the project owner can edit project details' });
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
    const access = await getProjectAccess(req.params.id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only the project owner can archive this project' });
    }

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
    const access = await getProjectAccess(req.params.id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only the project owner can restore this project' });
    }

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
    const access = await getProjectAccess(req.params.id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only the project owner can delete this project' });
    }

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

router.get('/:id/shares', authenticateToken, async (req, res) => {
  try {
    const access = await getProjectAccess(req.params.id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await pool.query(
      `SELECT ps.shared_with_user_id AS user_id, p.username, p.full_name, p.avatar_url
       FROM project_shares ps
       JOIN profiles p ON p.id = ps.shared_with_user_id
       WHERE ps.project_id = $1
       ORDER BY p.username ASC`,
      [req.params.id]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching project shares:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/shares', authenticateToken, async (req, res) => {
  try {
    const access = await getProjectAccess(req.params.id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only the project owner can share this project' });
    }

    const identifier = String(req.body?.username || req.body?.email || '').trim();
    if (!identifier) {
      return res.status(400).json({ error: 'Username or email is required' });
    }

    let targetUserResult;
    const isEmail = identifier.includes('@');

    if (isEmail) {
      targetUserResult = await pool.query(
        `SELECT p.id, p.username, p.full_name, p.avatar_url
         FROM profiles p
         JOIN auth.users u ON u.id = p.id
         WHERE LOWER(u.email) = LOWER($1)
         LIMIT 1`,
        [identifier]
      );
    } else {
      targetUserResult = await pool.query(
        'SELECT id, username, full_name, avatar_url FROM profiles WHERE username = $1 LIMIT 1',
        [identifier]
      );
    }

    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = targetUserResult.rows[0];
    if (targetUser.id === req.userId) {
      return res.status(400).json({ error: 'You already own this project' });
    }

    const projectOwnerResult = await pool.query(
      'SELECT user_id FROM projects WHERE id = $1 LIMIT 1',
      [req.params.id]
    );
    if (projectOwnerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (projectOwnerResult.rows[0].user_id === targetUser.id) {
      return res.status(400).json({ error: 'Cannot share with the project owner' });
    }

    await pool.query(
      `INSERT INTO project_shares (project_id, shared_with_user_id)
       VALUES ($1, $2)
       ON CONFLICT (project_id, shared_with_user_id) DO NOTHING`,
      [req.params.id, targetUser.id]
    );

    res.status(201).json({
      user_id: targetUser.id,
      username: targetUser.username,
      full_name: targetUser.full_name,
      avatar_url: targetUser.avatar_url
    });
  } catch (error) {
    console.error('Error sharing project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/shares/:sharedUserId', authenticateToken, async (req, res) => {
  try {
    const access = await getProjectAccess(req.params.id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only the project owner can remove sharing' });
    }

    await pool.query(
      'DELETE FROM project_shares WHERE project_id = $1 AND shared_with_user_id = $2',
      [req.params.id, req.params.sharedUserId]
    );

    res.json({ message: 'Share removed' });
  } catch (error) {
    console.error('Error removing project share:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

