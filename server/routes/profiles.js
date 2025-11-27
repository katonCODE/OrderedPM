// server/routes/profiles.js
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const authenticateToken = require('../middleware/auth');

// Helper function to count words in a string
const countWords = (text) => {
  if (!text || text.trim() === '') return 0;
  return text.trim().split(/\s+/).length;
};

// Get current user's profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, full_name, avatar_url, bio FROM profiles WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get public profile by username
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const result = await pool.query(
      'SELECT id, username, full_name, avatar_url, bio FROM profiles WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update current user's profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { username, full_name, bio, avatar_url } = req.body;

    // Validate username uniqueness if provided
    if (username !== undefined) {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        return res.status(400).json({ error: 'Username cannot be empty' });
      }

      // Check if username already exists for a different user
      const existingProfile = await pool.query(
        'SELECT id FROM profiles WHERE username = $1 AND id != $2',
        [trimmedUsername, req.userId]
      );

      if (existingProfile.rows.length > 0) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    // Validate bio word count if provided
    if (bio !== undefined) {
      const wordCount = countWords(bio);
      if (wordCount > 150) {
        return res.status(400).json({ error: 'Bio must be 150 words or less' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (username !== undefined) {
      updates.push(`username = $${paramCount++}`);
      values.push(username.trim());
    }
    if (full_name !== undefined) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(full_name?.trim() || null);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramCount++}`);
      values.push(bio?.trim() || null);
    }
    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`);
      values.push(avatar_url || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add user_id for WHERE clause
    values.push(req.userId);

    const queryText = `
      UPDATE profiles 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING id, username, full_name, avatar_url, bio
    `;

    const result = await pool.query(queryText, values);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

