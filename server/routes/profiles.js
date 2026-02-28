// server/routes/profiles.js
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const authenticateToken = require('../middleware/auth');
const { validateStringLength } = require('../utils/validation');

// Helper function to count words in a string
const countWords = (text) => {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  // Split by whitespace and filter out empty strings (handles multiple spaces)
  return trimmed.split(/\s+/).filter(word => word.length > 0).length;
};

// Get current user's profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, full_name, avatar_url, bio, created_at, updated_at FROM profiles WHERE id = $1',
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

// Create/initialize profile
router.post('/me', authenticateToken, async (req, res) => {
  try {
    const { username, full_name, bio, avatar_url } = req.body;

    // Check if profile already exists
    const existingProfile = await pool.query(
      'SELECT id FROM profiles WHERE id = $1',
      [req.userId]
    );

    if (existingProfile.rows.length > 0) {
      return res.status(409).json({ error: 'Profile already exists' });
    }

    // Validate username
    const usernameValidation = validateStringLength(username, 50, false);
    if (!usernameValidation.valid) {
      return res.status(400).json({ error: usernameValidation.error || 'Username is required' });
    }

    const trimmedUsername = username.trim();

    // Check if username already exists
    const usernameCheck = await pool.query(
      'SELECT id FROM profiles WHERE username = $1',
      [trimmedUsername]
    );

    if (usernameCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Validate bio word count if provided
    if (bio !== undefined && bio !== null) {
      const bioValidation = validateStringLength(bio, 2000, true);
      if (!bioValidation.valid) {
        return res.status(400).json({ error: bioValidation.error });
      }
      const wordCount = countWords(bio);
      if (wordCount > 150) {
        return res.status(400).json({ error: 'Bio must be 150 words or less' });
      }
    }

    // Validate full_name length if provided
    if (full_name !== undefined && full_name !== null) {
      const fullNameValidation = validateStringLength(full_name, 200, true);
      if (!fullNameValidation.valid) {
        return res.status(400).json({ error: fullNameValidation.error });
      }
    }

    // Create profile
    const result = await pool.query(
      `INSERT INTO profiles (id, username, full_name, bio, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, full_name, avatar_url, bio, created_at, updated_at`,
      [
        req.userId,
        trimmedUsername,
        full_name?.trim() || null,
        bio?.trim() || null,
        avatar_url || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating profile:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get public profile by username
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username || username.trim() === '') {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const result = await pool.query(
      'SELECT id, username, full_name, avatar_url, bio, created_at FROM profiles WHERE username = $1',
      [username.trim()]
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
      const usernameValidation = validateStringLength(username, 50, false);
      if (!usernameValidation.valid) {
        return res.status(400).json({ error: usernameValidation.error || 'Username cannot be empty' });
      }

      const trimmedUsername = username.trim();

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
      const bioValidation = validateStringLength(bio, 2000, true);
      if (!bioValidation.valid) {
        return res.status(400).json({ error: bioValidation.error });
      }
      const wordCount = countWords(bio);
      if (wordCount > 150) {
        return res.status(400).json({ error: 'Bio must be 150 words or less' });
      }
    }

    // Validate full_name length if provided
    if (full_name !== undefined && full_name !== null) {
      const fullNameValidation = validateStringLength(full_name, 200, true);
      if (!fullNameValidation.valid) {
        return res.status(400).json({ error: fullNameValidation.error });
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

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating profile:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

