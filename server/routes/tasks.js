// server/routes/tasks.js
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const authenticateToken = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    // Validate limit and offset
    const validLimit = Math.min(Math.max(1, limit), 100); // Between 1 and 100
    const validOffset = Math.max(0, offset);
    
    // Get total count for pagination metadata
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM tasks WHERE project_id = $1 AND user_id = $2',
      [req.params.projectId, req.userId]
    );
    const total = parseInt(countResult.rows[0].count);
    
    // Get paginated tasks, ordered by position (for Kanban) then created_at
    const result = await pool.query(
      'SELECT * FROM tasks WHERE project_id = $1 AND user_id = $2 ORDER BY COALESCE(position, 0) ASC, created_at DESC LIMIT $3 OFFSET $4',
      [req.params.projectId, req.userId, validLimit, validOffset]
    );

    res.json({
      data: result.rows,
      pagination: {
        total,
        limit: validLimit,
        offset: validOffset,
        hasMore: validOffset + validLimit < total
      }
    });
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

// Generate task using AI
router.post('/ai/generate', authenticateToken, async (req, res) => {
  try {
    const { prompt, project_id } = req.body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt is required and must be a non-empty string' });
    }

    // Optionally validate project_id if provided
    if (project_id) {
      const projectCheck = await pool.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [project_id, req.userId]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    // Check if GEMINI_API_KEY exists
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      return res.status(500).json({ error: 'AI service is not configured' });
    }

    // Initialize Google Generative AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Create prompt for Gemini
    const aiPrompt = `Based on the following user request, generate a task with a title, description, and priority level.

User request: "${prompt.trim()}"

Please respond with ONLY a valid JSON object in this exact format (no markdown, no code blocks, just the JSON):
{
  "title": "A clear and concise task title",
  "description": "A detailed description of the task",
  "priority": "low" | "medium" | "high"
}

The priority should be:
- "low" for non-urgent tasks
- "medium" for normal tasks
- "high" for urgent or important tasks

Return only the JSON object, nothing else.`;

    // Generate content
    const result = await model.generateContent(aiPrompt);
    const response = await result.response;
    let text = response.text();

    // Remove markdown code block wrappers if present
    text = text.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    }
    text = text.trim();

    // Parse JSON response
    let taskData;
    try {
      taskData = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    }

    // Validate required fields
    if (!taskData.title || typeof taskData.title !== 'string') {
      return res.status(500).json({ error: 'AI response missing valid title' });
    }

    // Validate and normalize priority
    const validPriorities = ['low', 'medium', 'high'];
    if (!taskData.priority || !validPriorities.includes(taskData.priority.toLowerCase())) {
      taskData.priority = 'medium';
    } else {
      taskData.priority = taskData.priority.toLowerCase();
    }

    // Ensure description exists (can be empty string)
    if (taskData.description === undefined || taskData.description === null) {
      taskData.description = '';
    }

    // Return the parsed task data
    res.json({
      title: taskData.title.trim(),
      description: taskData.description.trim() || null,
      priority: taskData.priority,
      project_id: project_id || null
    });
  } catch (error) {
    console.error('Error generating task with AI:', error);
    res.status(500).json({ error: 'Failed to generate task. Please try again.' });
  }
});

// Create a new task
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { project_id, title, description, status, start_date, due_date, priority } = req.body;

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
      'INSERT INTO tasks (project_id, user_id, title, description, status, start_date, due_date, priority) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [project_id, req.userId, title.trim(), description?.trim() || null, validStatus, start_date || null, due_date || null, validPriority]
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
    // Verify task exists and belongs to user
    const existingTask = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (existingTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { title, description, status, start_date, due_date, priority, prevPosition, nextPosition } = req.body;

    // Prepare values: use provided value if present, otherwise null (COALESCE will use existing)
    let updatedTitle = null;
    let updatedDescription = null;
    let updatedStatus = null;
    let updatedStartDate = null;
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

    if (start_date !== undefined) {
      updatedStartDate = start_date || null;
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
        start_date = COALESCE($4, start_date),
        due_date = COALESCE($5, due_date),
        priority = COALESCE($6, priority),
        position = COALESCE($7, position),
        updated_at = NOW()
      WHERE id = $8 AND user_id = $9
      RETURNING *
    `;

    const values = [
      updatedTitle,
      updatedDescription,
      updatedStatus,
      updatedStartDate,
      updatedDueDate,
      updatedPriority,
      updatedPosition,
      req.params.id,
      req.userId
    ];

    const result = await pool.query(queryText, values);

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

