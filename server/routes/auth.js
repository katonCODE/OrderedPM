// server/routes/auth.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

// Get current user info from JWT token
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      id: req.userId,
      email: req.user.email,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

