// server/routes/tasks.js
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const authenticateToken = require('../middleware/auth');
const createAIRateLimiter = require('../middleware/rateLimit');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const aiRateLimiter = createAIRateLimiter();
const VALID_RECURRENCE_TYPES = ['daily', 'weekly', 'monthly'];

const parseDateOnly = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;
  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
};

const formatDateOnly = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const addRecurrenceToDate = (dateString, recurrenceType, recurrenceInterval) => {
  if (!dateString) return null;
  const date = parseDateOnly(dateString);
  if (!date) return null;

  if (recurrenceType === 'daily') {
    date.setUTCDate(date.getUTCDate() + recurrenceInterval);
  } else if (recurrenceType === 'weekly') {
    date.setUTCDate(date.getUTCDate() + (7 * recurrenceInterval));
  } else if (recurrenceType === 'monthly') {
    date.setUTCMonth(date.getUTCMonth() + recurrenceInterval);
  }

  return formatDateOnly(date);
};

const getTaskDependencies = async (taskId, userId) => {
  const blockedByResult = await pool.query(
    `SELECT t.id, t.title, t.status
     FROM task_dependencies td
     JOIN tasks t ON t.id = td.blocker_task_id
     WHERE td.blocked_task_id = $1 AND t.user_id = $2
     ORDER BY t.created_at ASC`,
    [taskId, userId]
  );

  const blockingResult = await pool.query(
    `SELECT t.id, t.title, t.status
     FROM task_dependencies td
     JOIN tasks t ON t.id = td.blocked_task_id
     WHERE td.blocker_task_id = $1 AND t.user_id = $2
     ORDER BY t.created_at ASC`,
    [taskId, userId]
  );

  return {
    blocked_by: blockedByResult.rows,
    blocking: blockingResult.rows
  };
};

// Get all tasks for the authenticated user (for dashboard stats)
router.get('/user/all', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1',
      [req.userId]
    );

    res.json({
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

    // Get total count for pagination metadata (only top-level tasks)
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM tasks WHERE project_id = $1 AND user_id = $2 AND parent_task_id IS NULL',
      [req.params.projectId, req.userId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated top-level tasks, ordered by position (for Kanban) then created_at
    const result = await pool.query(
      `SELECT 
        t.*,
        (
          SELECT COUNT(*)
          FROM task_dependencies td
          WHERE td.blocked_task_id = t.id
        ) AS blocked_by_count,
        (
          SELECT COUNT(*)
          FROM task_dependencies td
          WHERE td.blocker_task_id = t.id
        ) AS blocking_count,
        COUNT(st.id) FILTER (WHERE st.status = 'done') as completed_subtasks,
        COUNT(st.id) as total_subtasks
      FROM tasks t
      LEFT JOIN tasks st ON st.parent_task_id = t.id AND st.user_id = t.user_id
      WHERE t.project_id = $1 AND t.user_id = $2 AND t.parent_task_id IS NULL
      GROUP BY t.id
      ORDER BY COALESCE(t.position, 0) ASC, t.created_at DESC
      LIMIT $3 OFFSET $4`,
      [req.params.projectId, req.userId, validLimit, validOffset]
    );

    // Get all subtasks for the returned tasks
    const parentTaskIds = result.rows.map(task => task.id);
    let subtasks = [];
    if (parentTaskIds.length > 0) {
      const subtasksResult = await pool.query(
        'SELECT * FROM tasks WHERE parent_task_id = ANY($1) AND user_id = $2 ORDER BY created_at ASC',
        [parentTaskIds, req.userId]
      );
      subtasks = subtasksResult.rows;
    }

    // Group subtasks under their parents
    const tasksWithSubtasks = result.rows.map(task => {
      const taskSubtasks = subtasks.filter(st => st.parent_task_id === task.id);
      return {
        ...task,
        blocked_by_count: parseInt(task.blocked_by_count) || 0,
        blocking_count: parseInt(task.blocking_count) || 0,
        completed_subtasks: parseInt(task.completed_subtasks) || 0,
        total_subtasks: parseInt(task.total_subtasks) || 0,
        subtasks: taskSubtasks
      };
    });

    res.json({
      data: tasksWithSubtasks,
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

// Global task search (title/description across all user projects)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      return res.json({ data: [] });
    }
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 50);
    const result = await pool.query(
      `SELECT t.id, t.project_id, t.title, t.status, t.due_date, t.priority, p.name AS project_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id AND p.user_id = t.user_id
       WHERE t.user_id = $1 AND t.parent_task_id IS NULL
         AND (t.title ILIKE $2 OR t.description ILIKE $2)
       ORDER BY t.updated_at DESC
       LIMIT $3`,
      [req.userId, `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`, limit]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error searching tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single task by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        t.*,
        (
          SELECT COUNT(*)
          FROM task_dependencies td
          WHERE td.blocked_task_id = t.id
        ) AS blocked_by_count,
        (
          SELECT COUNT(*)
          FROM task_dependencies td
          WHERE td.blocker_task_id = t.id
        ) AS blocking_count,
        COUNT(st.id) FILTER (WHERE st.status = 'done') as completed_subtasks,
        COUNT(st.id) as total_subtasks
      FROM tasks t
      LEFT JOIN tasks st ON st.parent_task_id = t.id AND st.user_id = t.user_id
      WHERE t.id = $1 AND t.user_id = $2
      GROUP BY t.id`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = result.rows[0];

    // Get subtasks
    const subtasksResult = await pool.query(
      'SELECT * FROM tasks WHERE parent_task_id = $1 AND user_id = $2 ORDER BY created_at ASC',
      [req.params.id, req.userId]
    );

    res.json({
      ...task,
      blocked_by_count: parseInt(task.blocked_by_count) || 0,
      blocking_count: parseInt(task.blocking_count) || 0,
      completed_subtasks: parseInt(task.completed_subtasks) || 0,
      total_subtasks: parseInt(task.total_subtasks) || 0,
      subtasks: subtasksResult.rows
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get subtasks for a task
router.get('/:id/subtasks', authenticateToken, async (req, res) => {
  try {
    // Verify parent task exists and belongs to user
    const parentTask = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (parentTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = await pool.query(
      'SELECT * FROM tasks WHERE parent_task_id = $1 AND user_id = $2 ORDER BY created_at ASC',
      [req.params.id, req.userId]
    );

    res.json({
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/dependencies', authenticateToken, async (req, res) => {
  try {
    const taskCheck = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const dependencies = await getTaskDependencies(req.params.id, req.userId);
    res.json(dependencies);
  } catch (error) {
    console.error('Error fetching task dependencies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/dependencies', authenticateToken, async (req, res) => {
  try {
    const { blocker_task_id } = req.body;

    if (!blocker_task_id) {
      return res.status(400).json({ error: 'Blocker task ID is required' });
    }

    if (blocker_task_id === req.params.id) {
      return res.status(400).json({ error: 'A task cannot depend on itself' });
    }

    const taskResult = await pool.query(
      'SELECT id, project_id FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const blockerResult = await pool.query(
      'SELECT id, project_id FROM tasks WHERE id = $1 AND user_id = $2',
      [blocker_task_id, req.userId]
    );
    if (blockerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Blocker task not found' });
    }

    const taskProjectId = taskResult.rows[0].project_id;
    const blockerProjectId = blockerResult.rows[0].project_id;

    if (taskProjectId !== blockerProjectId) {
      return res.status(400).json({ error: 'Dependencies must be within the same project' });
    }

    const cycleResult = await pool.query(
      `WITH RECURSIVE reachable AS (
        SELECT blocked_task_id
        FROM task_dependencies
        WHERE blocker_task_id = $1
        UNION
        SELECT td.blocked_task_id
        FROM task_dependencies td
        JOIN reachable r ON td.blocker_task_id = r.blocked_task_id
      )
      SELECT 1
      FROM reachable
      WHERE blocked_task_id = $2
      LIMIT 1`,
      [req.params.id, blocker_task_id]
    );

    if (cycleResult.rows.length > 0) {
      return res.status(400).json({ error: 'This dependency would create a cycle' });
    }

    await pool.query(
      `INSERT INTO task_dependencies (blocked_task_id, blocker_task_id)
       VALUES ($1, $2)
       ON CONFLICT (blocked_task_id, blocker_task_id) DO NOTHING`,
      [req.params.id, blocker_task_id]
    );

    const dependencies = await getTaskDependencies(req.params.id, req.userId);
    res.status(201).json(dependencies);
  } catch (error) {
    console.error('Error adding task dependency:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/dependencies/:blockerId', authenticateToken, async (req, res) => {
  try {
    const taskCheck = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const blockerCheck = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.blockerId, req.userId]
    );
    if (blockerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Blocker task not found' });
    }

    await pool.query(
      'DELETE FROM task_dependencies WHERE blocked_task_id = $1 AND blocker_task_id = $2',
      [req.params.id, req.params.blockerId]
    );

    const dependencies = await getTaskDependencies(req.params.id, req.userId);
    res.json(dependencies);
  } catch (error) {
    console.error('Error removing task dependency:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate task using AI
router.post('/ai/generate', authenticateToken, aiRateLimiter, async (req, res) => {
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
    const {
      project_id,
      title,
      description,
      status,
      start_date,
      due_date,
      priority,
      parent_task_id,
      tags,
      recurrence_type,
      recurrence_interval,
      recurrence_end_date
    } = req.body;

    if (!project_id && !parent_task_id) {
      return res.status(400).json({ error: 'Either Project ID or Parent Task ID is required' });
    }

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Task title is required' });
    }

    let projectId = project_id;
    let parentTaskId = parent_task_id || null;

    // If parent_task_id is provided, verify it exists and get its project_id
    if (parent_task_id) {
      const parentTask = await pool.query(
        'SELECT project_id FROM tasks WHERE id = $1 AND user_id = $2',
        [parent_task_id, req.userId]
      );

      if (parentTask.rows.length === 0) {
        return res.status(404).json({ error: 'Parent task not found' });
      }

      projectId = parentTask.rows[0].project_id;
      // Ensure parent_task_id is set
      parentTaskId = parent_task_id;
    }

    // Verify the project belongs to the user
    const projectCheck = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.userId]
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

    let validRecurrenceType = null;
    let validRecurrenceInterval = null;
    let validRecurrenceEndDate = null;
    if (recurrence_type !== undefined && recurrence_type !== null && recurrence_type !== '') {
      const normalizedType = String(recurrence_type).toLowerCase();
      if (!VALID_RECURRENCE_TYPES.includes(normalizedType)) {
        return res.status(400).json({ error: 'Invalid recurrence type. Must be daily, weekly, or monthly' });
      }
      validRecurrenceType = normalizedType;

      if (recurrence_interval !== undefined && recurrence_interval !== null && recurrence_interval !== '') {
        const parsedInterval = parseInt(recurrence_interval, 10);
        if (!Number.isInteger(parsedInterval) || parsedInterval < 1) {
          return res.status(400).json({ error: 'Recurrence interval must be a positive integer' });
        }
        validRecurrenceInterval = parsedInterval;
      } else {
        validRecurrenceInterval = 1;
      }

      validRecurrenceEndDate = recurrence_end_date || null;
    } else if (
      recurrence_interval !== undefined ||
      (recurrence_end_date !== undefined && recurrence_end_date !== null && recurrence_end_date !== '')
    ) {
      return res.status(400).json({ error: 'Recurrence type is required when recurrence interval or end date is set' });
    }

    // Validate and normalize tags
    let validTags = [];
    if (tags !== undefined && tags !== null) {
      if (Array.isArray(tags)) {
        validTags = tags
          .map(tag => typeof tag === 'string' ? tag.trim() : String(tag).trim())
          .filter(tag => tag.length > 0)
          .slice(0, 20); // Limit to 20 tags
      } else {
        return res.status(400).json({ error: 'Tags must be an array' });
      }
    }

    const result = await pool.query(
      `INSERT INTO tasks (
        project_id, user_id, title, description, status, start_date, due_date, priority, parent_task_id, tags,
        recurrence_type, recurrence_interval, recurrence_end_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        projectId,
        req.userId,
        title.trim(),
        description?.trim() || null,
        validStatus,
        start_date || null,
        due_date || null,
        validPriority,
        parentTaskId,
        JSON.stringify(validTags),
        validRecurrenceType,
        validRecurrenceInterval,
        validRecurrenceEndDate
      ]
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

    const {
      title,
      description,
      status,
      start_date,
      due_date,
      priority,
      prevPosition,
      nextPosition,
      parent_task_id,
      tags,
      recurrence_type,
      recurrence_interval,
      recurrence_end_date
    } = req.body;

    // Prepare values: use provided value if present, otherwise null (COALESCE will use existing)
    let updatedTitle = null;
    let shouldUpdateDescription = false;
    let updatedDescription = null;
    let updatedStatus = null;
    let shouldUpdateStartDate = false;
    let updatedStartDate = null;
    let shouldUpdateDueDate = false;
    let updatedDueDate = null;
    let updatedPriority = null;
    let updatedPosition = null;
    let shouldUpdateParentTaskId = false;
    let updatedParentTaskId = null;
    let updatedTags = null;
    let shouldUpdateRecurrenceType = false;
    let shouldUpdateRecurrenceInterval = false;
    let shouldUpdateRecurrenceEndDate = false;
    let updatedRecurrenceType = null;
    let updatedRecurrenceInterval = null;
    let updatedRecurrenceEndDate = null;

    if (title !== undefined) {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return res.status(400).json({ error: 'Task title cannot be empty' });
      }
      updatedTitle = trimmedTitle;
    }

    if (description !== undefined) {
      shouldUpdateDescription = true;
      updatedDescription = description?.trim() || null;
    }

    if (status !== undefined) {
      if (['todo', 'in_progress', 'done'].includes(status)) {
        if (status === 'done' && existingTask.rows[0].status !== 'done') {
          const blockersResult = await pool.query(
            `SELECT t.id, t.title
             FROM task_dependencies td
             JOIN tasks t ON t.id = td.blocker_task_id
             WHERE td.blocked_task_id = $1
               AND t.user_id = $2
               AND t.status != 'done'
             ORDER BY t.created_at ASC`,
            [req.params.id, req.userId]
          );

          if (blockersResult.rows.length > 0) {
            return res.status(400).json({
              error: `Task is blocked by: ${blockersResult.rows.map(t => t.title).join(', ')}`
            });
          }
        }

        updatedStatus = status;
      } else {
        return res.status(400).json({ error: 'Invalid status value' });
      }
    }

    if (start_date !== undefined) {
      shouldUpdateStartDate = true;
      updatedStartDate = start_date || null;
    }

    if (due_date !== undefined) {
      shouldUpdateDueDate = true;
      updatedDueDate = due_date || null;
    }

    if (priority !== undefined) {
      if (['low', 'medium', 'high'].includes(priority)) {
        updatedPriority = priority;
      } else {
        return res.status(400).json({ error: 'Invalid priority value. Must be low, medium, or high' });
      }
    }

    // Handle parent_task_id update
    if (parent_task_id !== undefined) {
      shouldUpdateParentTaskId = true;
      if (parent_task_id === null) {
        // Removing parent (making it a top-level task)
        updatedParentTaskId = null;
      } else {
        // Verify parent task exists and belongs to user
        const parentCheck = await pool.query(
          'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
          [parent_task_id, req.userId]
        );

        if (parentCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Parent task not found' });
        }

        // Prevent circular reference (task can't be its own parent)
        if (parent_task_id === req.params.id) {
          return res.status(400).json({ error: 'Task cannot be its own parent' });
        }

        updatedParentTaskId = parent_task_id;
      }
    }

    // Handle tags update
    if (tags !== undefined) {
      if (tags === null) {
        updatedTags = JSON.stringify([]);
      } else if (Array.isArray(tags)) {
        const validTags = tags
          .map(tag => typeof tag === 'string' ? tag.trim() : String(tag).trim())
          .filter(tag => tag.length > 0)
          .slice(0, 20); // Limit to 20 tags
        updatedTags = JSON.stringify(validTags);
      } else {
        return res.status(400).json({ error: 'Tags must be an array' });
      }
    } else {
      // If tags is undefined, set to null so CASE keeps existing value
      updatedTags = null;
    }

    if (recurrence_type !== undefined || recurrence_interval !== undefined || recurrence_end_date !== undefined) {
      if (recurrence_type === null || recurrence_type === '') {
        shouldUpdateRecurrenceType = true;
        shouldUpdateRecurrenceInterval = true;
        shouldUpdateRecurrenceEndDate = true;
        updatedRecurrenceType = null;
        updatedRecurrenceInterval = null;
        updatedRecurrenceEndDate = null;
      } else {
        const baseType = recurrence_type !== undefined
          ? String(recurrence_type).toLowerCase()
          : existingTask.rows[0].recurrence_type;

        if (!baseType || !VALID_RECURRENCE_TYPES.includes(baseType)) {
          return res.status(400).json({ error: 'Invalid recurrence type. Must be daily, weekly, or monthly' });
        }

        let baseInterval;
        if (recurrence_interval !== undefined && recurrence_interval !== null && recurrence_interval !== '') {
          const parsedInterval = parseInt(recurrence_interval, 10);
          if (!Number.isInteger(parsedInterval) || parsedInterval < 1) {
            return res.status(400).json({ error: 'Recurrence interval must be a positive integer' });
          }
          baseInterval = parsedInterval;
        } else if (recurrence_interval === null || recurrence_interval === '') {
          baseInterval = 1;
        } else {
          baseInterval = existingTask.rows[0].recurrence_interval || 1;
        }

        let baseEndDate;
        if (recurrence_end_date !== undefined) {
          baseEndDate = recurrence_end_date || null;
        } else {
          baseEndDate = existingTask.rows[0].recurrence_end_date || null;
        }

        shouldUpdateRecurrenceType = true;
        shouldUpdateRecurrenceInterval = true;
        shouldUpdateRecurrenceEndDate = true;
        updatedRecurrenceType = baseType;
        updatedRecurrenceInterval = baseInterval;
        updatedRecurrenceEndDate = baseEndDate;
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

    // Build dynamic query based on what's being updated
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    let queryText = ''; // Initialize for error handling

    if (updatedTitle !== null) {
      updateFields.push(`title = $${paramIndex++}`);
      updateValues.push(updatedTitle);
    }
    if (shouldUpdateDescription) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(updatedDescription);
    }
    if (updatedStatus !== null) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(updatedStatus);
    }
    if (shouldUpdateStartDate) {
      updateFields.push(`start_date = $${paramIndex++}`);
      updateValues.push(updatedStartDate);
    }
    if (shouldUpdateDueDate) {
      updateFields.push(`due_date = $${paramIndex++}`);
      updateValues.push(updatedDueDate);
    }
    if (updatedPriority !== null) {
      updateFields.push(`priority = $${paramIndex++}`);
      updateValues.push(updatedPriority);
    }
    if (updatedPosition !== null) {
      updateFields.push(`position = $${paramIndex++}`);
      updateValues.push(updatedPosition);
    }
    if (shouldUpdateParentTaskId) {
      updateFields.push(`parent_task_id = $${paramIndex++}`);
      updateValues.push(updatedParentTaskId);
    }
    if (updatedTags !== null) {
      updateFields.push(`tags = $${paramIndex++}::jsonb`);
      updateValues.push(updatedTags);
    }
    if (shouldUpdateRecurrenceType) {
      updateFields.push(`recurrence_type = $${paramIndex++}`);
      updateValues.push(updatedRecurrenceType);
    }
    if (shouldUpdateRecurrenceInterval) {
      updateFields.push(`recurrence_interval = $${paramIndex++}`);
      updateValues.push(updatedRecurrenceInterval);
    }
    if (shouldUpdateRecurrenceEndDate) {
      updateFields.push(`recurrence_end_date = $${paramIndex++}`);
      updateValues.push(updatedRecurrenceEndDate);
    }

    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    queryText = `
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING *
    `;

    updateValues.push(req.params.id, req.userId);

    const result = await pool.query(queryText, updateValues);

    const previousTask = existingTask.rows[0];
    const updatedTask = result.rows[0];

    const shouldGenerateNextTask = (
      previousTask.status !== 'done' &&
      updatedTask.status === 'done' &&
      updatedTask.recurrence_type &&
      !updatedTask.parent_task_id
    );

    if (shouldGenerateNextTask) {
      const recurrenceInterval = updatedTask.recurrence_interval || 1;
      const nextDueDate = addRecurrenceToDate(updatedTask.due_date, updatedTask.recurrence_type, recurrenceInterval);
      const nextStartDate = addRecurrenceToDate(updatedTask.start_date, updatedTask.recurrence_type, recurrenceInterval);
      const nextAnchorDate = nextDueDate || nextStartDate;
      const recurrenceEndDate = updatedTask.recurrence_end_date || null;
      const isWithinRecurrenceWindow = !recurrenceEndDate || !nextAnchorDate || nextAnchorDate <= recurrenceEndDate;

      if (isWithinRecurrenceWindow) {
        await pool.query(
          `INSERT INTO tasks (
            project_id, user_id, title, description, status, start_date, due_date, priority, parent_task_id, tags,
            recurrence_type, recurrence_interval, recurrence_end_date
          ) VALUES ($1, $2, $3, $4, 'todo', $5, $6, $7, NULL, $8::jsonb, $9, $10, $11)`,
          [
            updatedTask.project_id,
            req.userId,
            updatedTask.title,
            updatedTask.description,
            nextStartDate,
            nextDueDate,
            updatedTask.priority || 'medium',
            JSON.stringify(updatedTask.tags || []),
            updatedTask.recurrence_type,
            recurrenceInterval,
            recurrenceEndDate
          ]
        );

        await pool.query(
          'UPDATE tasks SET last_generated_at = NOW() WHERE id = $1 AND user_id = $2',
          [updatedTask.id, req.userId]
        );
      }
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    console.error('Error details:', error.message, error.stack);

    // Provide more specific error messages
    if (error.code === '23514') {
      return res.status(400).json({ error: 'Tags must be a valid JSON array' });
    }

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

