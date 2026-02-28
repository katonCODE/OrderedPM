// server/routes/tasks.js
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const authenticateToken = require('../middleware/auth');
const createAIRateLimiter = require('../middleware/rateLimit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { safeParseInt, isValidUUID, validateStringLength, safeJsonParse } = require('../utils/validation');

const aiRateLimiter = createAIRateLimiter();
const VALID_RECURRENCE_TYPES = ['daily', 'weekly', 'monthly'];
const VALID_FOCUS_OUTCOMES = ['completed', 'progress', 'blocked', 'cancelled'];
const DEFAULT_ESTIMATED_MINUTES = 30;

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

const normalizeEstimatedMinutes = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return NaN;
  return parsed;
};

const normalizeTimeBudget = (value) => {
  if (value === undefined || value === null || value === '') return 120;
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1440) return NaN;
  return parsed;
};

const normalizeFocusMinutes = (value) => {
  if (value === undefined || value === null || value === '') return 25;
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 240) return NaN;
  return parsed;
};

const getPriorityScore = (priority) => {
  if (priority === 'high') return 300;
  if (priority === 'medium') return 200;
  return 100;
};

const getDateUrgencyScore = (dueDate) => {
  if (!dueDate) return 0;
  const due = parseDateOnly(dueDate);
  if (!due) return 0;
  const today = parseDateOnly(formatDateOnly(new Date()));
  if (!today) return 0;
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return 120;
  if (diffDays === 0) return 100;
  if (diffDays === 1) return 70;
  if (diffDays <= 3) return 40;
  if (diffDays <= 7) return 20;
  return 0;
};

const getTaskPlanScore = (task) => {
  const statusScore = task.status === 'in_progress' ? 30 : 0;
  const recurrenceScore = task.recurrence_type ? 15 : 0;
  return getPriorityScore(task.priority) + getDateUrgencyScore(task.due_date) + statusScore + recurrenceScore;
};

const hasProjectAccess = async (projectId, userId) => {
  const result = await pool.query(
    `SELECT 1
     FROM projects p
     LEFT JOIN project_shares ps
       ON ps.project_id = p.id
      AND ps.shared_with_user_id = $2
     WHERE p.id = $1
       AND (p.user_id = $2 OR ps.shared_with_user_id IS NOT NULL)
     LIMIT 1`,
    [projectId, userId]
  );
  return result.rows.length > 0;
};

const getProjectAccess = async (projectId, userId) => {
  const result = await pool.query(
    `SELECT p.id, p.user_id, ps.permission_level
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
    return { hasAccess: false, isOwner: false, permissionLevel: null };
  }

  const isOwner = result.rows[0].user_id === userId;
  return {
    hasAccess: true,
    isOwner,
    permissionLevel: isOwner ? 'admin' : (result.rows[0].permission_level || 'editor')
  };
};

const canCreateTask = (access) => {
  return access.isOwner || access.permissionLevel === 'editor' || access.permissionLevel === 'admin';
};

const canEditTask = (access) => {
  return access.isOwner || access.permissionLevel === 'editor' || access.permissionLevel === 'admin';
};

const canDeleteTask = (access) => {
  return access.isOwner || access.permissionLevel === 'admin';
};

const logTaskActivity = async (taskId, userId, activityType, oldValue = null, newValue = null, metadata = {}) => {
  try {
    await pool.query(
      `INSERT INTO task_activities (task_id, user_id, activity_type, old_value, new_value, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [taskId, userId, activityType, oldValue, newValue, JSON.stringify(metadata)]
    );
  } catch (error) {
    // Log to monitoring service (Sentry, DataDog, etc.) if available
    console.error('Error logging task activity:', error);
    
    // Ensure error is visible in logs for debugging
    // Don't throw - activity logging shouldn't break main flow
    // But ensure visibility for debugging
    if (process.env.NODE_ENV === 'production') {
      // In production, you might want to send to monitoring service
      // monitoringService.captureException(error, { tags: { component: 'activity-logging' } });
    }
  }
};

const getAccessibleTask = async (taskId, userId) => {
  const result = await pool.query(
    `SELECT t.*
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN project_shares ps
       ON ps.project_id = p.id
      AND ps.shared_with_user_id = $2
     WHERE t.id = $1
       AND (p.user_id = $2 OR ps.shared_with_user_id IS NOT NULL)
     LIMIT 1`,
    [taskId, userId]
  );
  return result.rows[0] || null;
};

const getTaskDependencies = async (taskId, userId) => {
  const blockedByResult = await pool.query(
    `SELECT t.id, t.title, t.status
     FROM task_dependencies td
     JOIN tasks t ON t.id = td.blocker_task_id
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN project_shares ps
       ON ps.project_id = p.id
      AND ps.shared_with_user_id = $2
     WHERE td.blocked_task_id = $1
       AND (p.user_id = $2 OR ps.shared_with_user_id IS NOT NULL)
     ORDER BY t.created_at ASC`,
    [taskId, userId]
  );

  const blockingResult = await pool.query(
    `SELECT t.id, t.title, t.status
     FROM task_dependencies td
     JOIN tasks t ON t.id = td.blocked_task_id
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN project_shares ps
       ON ps.project_id = p.id
      AND ps.shared_with_user_id = $2
     WHERE td.blocker_task_id = $1
       AND (p.user_id = $2 OR ps.shared_with_user_id IS NOT NULL)
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
      `SELECT t.*
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN project_shares ps
         ON ps.project_id = p.id
        AND ps.shared_with_user_id = $1
       WHERE p.user_id = $1 OR ps.shared_with_user_id IS NOT NULL`,
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
    // Validate project ID UUID format
    if (!isValidUUID(req.params.projectId)) {
      return res.status(400).json({ error: 'Invalid project ID format' });
    }

    const canAccessProject = await hasProjectAccess(req.params.projectId, req.userId);
    if (!canAccessProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const limit = safeParseInt(req.query.limit, 50, 1, 100);
    const offset = safeParseInt(req.query.offset, 0, 0);

    // Validate limit and offset (already validated by safeParseInt)
    const validLimit = limit;
    const validOffset = offset;

    // Get total count for pagination metadata (only top-level tasks)
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM tasks WHERE project_id = $1 AND parent_task_id IS NULL',
      [req.params.projectId]
    );
    const total = safeParseInt(countResult.rows[0]?.count, 0, 0);

    // Get paginated top-level tasks, ordered by position (for Kanban) then created_at
    const result = await pool.query(
      `SELECT 
        t.*,
        tp.username AS creator_username,
        tp.full_name AS creator_full_name,
        tp.avatar_url AS creator_avatar_url,
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
      LEFT JOIN tasks st ON st.parent_task_id = t.id
      LEFT JOIN profiles tp ON tp.id = t.user_id
      WHERE t.project_id = $1 AND t.parent_task_id IS NULL
      GROUP BY t.id, tp.username, tp.full_name, tp.avatar_url
      ORDER BY COALESCE(t.position, 0) ASC, t.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.params.projectId, validLimit, validOffset]
    );

    // Get all subtasks for the returned tasks
    const parentTaskIds = Array.isArray(result.rows) ? result.rows.map(task => task.id) : [];
    let subtasks = [];
    if (parentTaskIds.length > 0) {
      const subtasksResult = await pool.query(
        `SELECT
          t.*,
          p.username AS creator_username,
          p.full_name AS creator_full_name,
          p.avatar_url AS creator_avatar_url
         FROM tasks t
         LEFT JOIN profiles p ON p.id = t.user_id
         WHERE t.parent_task_id = ANY($1)
         ORDER BY t.created_at ASC`,
        [parentTaskIds]
      );
      subtasks = Array.isArray(subtasksResult.rows) ? subtasksResult.rows : [];
    }

    // Group subtasks under their parents
    const tasksWithSubtasks = Array.isArray(result.rows) ? result.rows.map(task => {
      const taskSubtasks = Array.isArray(subtasks) ? subtasks.filter(st => st && st.parent_task_id === task.id) : [];
      return {
        ...task,
        blocked_by_count: safeParseInt(task.blocked_by_count, 0, 0),
        blocking_count: safeParseInt(task.blocking_count, 0, 0),
        completed_subtasks: safeParseInt(task.completed_subtasks, 0, 0),
        total_subtasks: safeParseInt(task.total_subtasks, 0, 0),
        subtasks: taskSubtasks
      };
    }) : [];

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
    const limit = safeParseInt(req.query.limit, 20, 1, 50);
    const result = await pool.query(
      `SELECT t.id, t.project_id, t.title, t.status, t.due_date, t.priority, p.name AS project_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN project_shares ps
         ON ps.project_id = p.id
        AND ps.shared_with_user_id = $1
       WHERE (p.user_id = $1 OR ps.shared_with_user_id IS NOT NULL)
         AND t.parent_task_id IS NULL
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

router.get('/today', authenticateToken, async (req, res) => {
  try {
    const today = formatDateOnly(new Date());
    const result = await pool.query(
      `SELECT t.*, p.name AS project_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN project_shares ps
         ON ps.project_id = p.id
        AND ps.shared_with_user_id = $1
       WHERE (p.user_id = $1 OR ps.shared_with_user_id IS NOT NULL)
         AND t.parent_task_id IS NULL
         AND t.status != 'done'
         AND p.archived = FALSE
         AND t.planned_for_date = $2
       ORDER BY t.plan_pinned DESC, COALESCE(t.position, 0) ASC, t.created_at DESC`,
      [req.userId, today]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching today plan tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/today/plan', authenticateToken, async (req, res) => {
  try {
    const timeBudgetMinutes = normalizeTimeBudget(req.body?.time_budget_minutes);
    if (Number.isNaN(timeBudgetMinutes)) {
      return res.status(400).json({ error: 'Time budget must be an integer between 1 and 1440 minutes' });
    }

    const save = req.body?.save === true;
    const pinnedTaskIds = Array.isArray(req.body?.pinned_task_ids)
      ? [...new Set(req.body.pinned_task_ids.filter(id => typeof id === 'string' && id.trim() !== ''))]
      : [];

    const candidatesResult = await pool.query(
      `SELECT t.*, p.name AS project_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN project_shares ps
         ON ps.project_id = p.id
        AND ps.shared_with_user_id = $1
       WHERE (p.user_id = $1 OR ps.shared_with_user_id IS NOT NULL)
         AND t.parent_task_id IS NULL
         AND t.status != 'done'
         AND p.archived = FALSE`,
      [req.userId]
    );

    const candidates = candidatesResult.rows.map(task => ({
      ...task,
      estimated_minutes: task.estimated_minutes || DEFAULT_ESTIMATED_MINUTES,
      score: getTaskPlanScore(task)
    }));

    const byId = new Map(candidates.map(task => [task.id, task]));
    const pinnedTasks = pinnedTaskIds
      .map(id => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    const pinnedIdSet = new Set(pinnedTasks.map(task => task.id));

    const sortedCandidates = candidates
      .filter(task => !pinnedIdSet.has(task.id))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aDue = a.due_date ? String(a.due_date) : '9999-12-31';
        const bDue = b.due_date ? String(b.due_date) : '9999-12-31';
        return aDue.localeCompare(bDue);
      });

    const included = [];
    const excluded = [];
    let usedMinutes = 0;

    for (const task of pinnedTasks) {
      included.push({
        ...task,
        reason: 'pinned'
      });
      usedMinutes += task.estimated_minutes;
    }

    for (const task of sortedCandidates) {
      if (usedMinutes + task.estimated_minutes <= timeBudgetMinutes) {
        included.push({
          ...task,
          reason: 'best_fit'
        });
        usedMinutes += task.estimated_minutes;
      } else {
        excluded.push({
          ...task,
          reason: 'over_budget'
        });
      }
    }

    if (save) {
      const today = formatDateOnly(new Date());
      await pool.query(
        `UPDATE tasks
         SET planned_for_date = NULL, plan_pinned = FALSE
         WHERE planned_for_date = $2
           AND project_id IN (
             SELECT p.id
             FROM projects p
             LEFT JOIN project_shares ps
               ON ps.project_id = p.id
              AND ps.shared_with_user_id = $1
             WHERE p.user_id = $1 OR ps.shared_with_user_id IS NOT NULL
           )`,
        [req.userId, today]
      );

      if (included.length > 0) {
        const includedIds = included.map(task => task.id);
        await pool.query(
          `UPDATE tasks
           SET planned_for_date = $1,
               plan_pinned = CASE WHEN id = ANY($2::uuid[]) THEN TRUE ELSE FALSE END
           WHERE id = ANY($4::uuid[])
             AND project_id IN (
               SELECT p.id
               FROM projects p
               LEFT JOIN project_shares ps
                 ON ps.project_id = p.id
                AND ps.shared_with_user_id = $3
               WHERE p.user_id = $3 OR ps.shared_with_user_id IS NOT NULL
             )`,
          [today, pinnedTaskIds, req.userId, includedIds]
        );
      }
    }

    res.json({
      data: {
        time_budget_minutes: timeBudgetMinutes,
        used_minutes: usedMinutes,
        included_tasks: included,
        excluded_tasks: excluded
      }
    });
  } catch (error) {
    console.error('Error generating today plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/focus/active', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fs.*, t.title AS task_title, t.project_id
       FROM focus_sessions fs
       JOIN tasks t ON t.id = fs.task_id
       WHERE fs.user_id = $1
         AND fs.ended_at IS NULL
       ORDER BY fs.started_at DESC
       LIMIT 1`,
      [req.userId]
    );

    res.json({
      data: result.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching active focus session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/focus/sessions', authenticateToken, async (req, res) => {
  try {
    // Validate task ID UUID format
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const task = await getAccessibleTask(req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const limit = safeParseInt(req.query.limit, 10, 1, 50);
    const result = await pool.query(
      `SELECT *
       FROM focus_sessions
       WHERE task_id = $1
         AND user_id = $2
       ORDER BY started_at DESC
       LIMIT $3`,
      [req.params.id, req.userId, limit]
    );

    res.json({
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching focus sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/focus/start', authenticateToken, async (req, res) => {
  try {
    // Validate task ID UUID format
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const task = await getAccessibleTask(req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const access = await getProjectAccess(task.project_id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (!canEditTask(access)) {
      return res.status(403).json({ error: 'You do not have permission to update tasks in this project' });
    }

    const plannedMinutes = normalizeFocusMinutes(req.body?.planned_minutes);
    if (Number.isNaN(plannedMinutes)) {
      return res.status(400).json({ error: 'Planned minutes must be an integer between 1 and 240' });
    }

    const activeResult = await pool.query(
      `SELECT fs.*, t.title AS task_title
       FROM focus_sessions fs
       JOIN tasks t ON t.id = fs.task_id
       WHERE fs.user_id = $1
         AND fs.ended_at IS NULL
       ORDER BY fs.started_at DESC
       LIMIT 1`,
      [req.userId]
    );

    const activeSession = activeResult.rows[0];
    if (activeSession) {
      if (activeSession.task_id === req.params.id) {
        return res.json({ data: activeSession });
      }
      return res.status(409).json({
        error: `You already have an active focus session on "${activeSession.task_title}"`,
        data: activeSession
      });
    }

    const result = await pool.query(
      `INSERT INTO focus_sessions (task_id, user_id, planned_minutes)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.id, req.userId, plannedMinutes]
    );

    res.status(201).json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error starting focus session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/focus/:sessionId/end', authenticateToken, async (req, res) => {
  try {
    // Validate task ID and session ID UUID formats
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }
    if (!isValidUUID(req.params.sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    const task = await getAccessibleTask(req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const access = await getProjectAccess(task.project_id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (!canEditTask(access)) {
      return res.status(403).json({ error: 'You do not have permission to update tasks in this project' });
    }

    const normalizedOutcome = req.body?.outcome
      ? String(req.body.outcome).toLowerCase()
      : 'progress';
    if (!VALID_FOCUS_OUTCOMES.includes(normalizedOutcome)) {
      return res.status(400).json({ error: 'Invalid outcome value' });
    }

    const note = req.body?.note === undefined || req.body?.note === null
      ? null
      : String(req.body.note).trim() || null;

    const activeSessionResult = await pool.query(
      `SELECT *
       FROM focus_sessions
       WHERE id = $1
         AND task_id = $2
         AND user_id = $3
         AND ended_at IS NULL
       LIMIT 1`,
      [req.params.sessionId, req.params.id, req.userId]
    );

    if (activeSessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Active focus session not found' });
    }

    const result = await pool.query(
      `UPDATE focus_sessions
       SET ended_at = NOW(),
           actual_minutes = GREATEST(1, CEIL(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60.0)::INTEGER),
           outcome = $1,
           note = $2
       WHERE id = $3
         AND task_id = $4
         AND user_id = $5
         AND ended_at IS NULL
       RETURNING *`,
      [normalizedOutcome, note, req.params.sessionId, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Focus session already ended' });
    }

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error ending focus session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single task by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // Validate task ID UUID format
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const result = await pool.query(
      `SELECT 
        t.*,
        tp.username AS creator_username,
        tp.full_name AS creator_full_name,
        tp.avatar_url AS creator_avatar_url,
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
      LEFT JOIN tasks st ON st.parent_task_id = t.id
      LEFT JOIN profiles tp ON tp.id = t.user_id
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN project_shares ps
        ON ps.project_id = p.id
       AND ps.shared_with_user_id = $2
      WHERE t.id = $1
        AND (p.user_id = $2 OR ps.shared_with_user_id IS NOT NULL)
      GROUP BY t.id, tp.username, tp.full_name, tp.avatar_url`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = result.rows[0];

    // Get subtasks
    const subtasksResult = await pool.query(
      `SELECT
        t.*,
        p.username AS creator_username,
        p.full_name AS creator_full_name,
        p.avatar_url AS creator_avatar_url
       FROM tasks t
       LEFT JOIN profiles p ON p.id = t.user_id
       WHERE t.parent_task_id = $1
       ORDER BY t.created_at ASC`,
      [req.params.id]
    );

    res.json({
      ...task,
      blocked_by_count: safeParseInt(task.blocked_by_count, 0, 0),
      blocking_count: safeParseInt(task.blocking_count, 0, 0),
      completed_subtasks: safeParseInt(task.completed_subtasks, 0, 0),
      total_subtasks: safeParseInt(task.total_subtasks, 0, 0),
      subtasks: Array.isArray(subtasksResult.rows) ? subtasksResult.rows : []
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get subtasks for a task
router.get('/:id/subtasks', authenticateToken, async (req, res) => {
  try {
    // Validate task ID UUID format
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const parentTask = await getAccessibleTask(req.params.id, req.userId);
    if (!parentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = await pool.query(
      'SELECT * FROM tasks WHERE parent_task_id = $1 ORDER BY created_at ASC',
      [req.params.id]
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
    // Validate task ID UUID format
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const task = await getAccessibleTask(req.params.id, req.userId);
    if (!task) {
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
    // Validate task ID UUID format
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const { blocker_task_id } = req.body;

    if (!blocker_task_id) {
      return res.status(400).json({ error: 'Blocker task ID is required' });
    }

    // Validate blocker task ID UUID format
    if (!isValidUUID(blocker_task_id)) {
      return res.status(400).json({ error: 'Invalid blocker task ID format' });
    }

    if (blocker_task_id === req.params.id) {
      return res.status(400).json({ error: 'A task cannot depend on itself' });
    }

    const taskRow = await getAccessibleTask(req.params.id, req.userId);
    if (!taskRow) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const access = await getProjectAccess(taskRow.project_id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (!canEditTask(access)) {
      return res.status(403).json({ error: 'You do not have permission to update task dependencies in this project' });
    }

    const blockerRow = await getAccessibleTask(blocker_task_id, req.userId);
    if (!blockerRow) {
      return res.status(404).json({ error: 'Blocker task not found' });
    }

    const taskProjectId = taskRow.project_id;
    const blockerProjectId = blockerRow.project_id;

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

    await logTaskActivity(req.params.id, req.userId, 'dependency_added', null, blocker_task_id, { blocker_task_title: blockerRow.title });

    const dependencies = await getTaskDependencies(req.params.id, req.userId);
    res.status(201).json(dependencies);
  } catch (error) {
    console.error('Error adding task dependency:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/dependencies/:blockerId', authenticateToken, async (req, res) => {
  try {
    // Validate task ID and blocker ID UUID formats
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }
    if (!isValidUUID(req.params.blockerId)) {
      return res.status(400).json({ error: 'Invalid blocker task ID format' });
    }

    const task = await getAccessibleTask(req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const access = await getProjectAccess(task.project_id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (!canEditTask(access)) {
      return res.status(403).json({ error: 'You do not have permission to update task dependencies in this project' });
    }

    const blocker = await getAccessibleTask(req.params.blockerId, req.userId);
    if (!blocker) {
      return res.status(404).json({ error: 'Blocker task not found' });
    }

    await pool.query(
      'DELETE FROM task_dependencies WHERE blocked_task_id = $1 AND blocker_task_id = $2',
      [req.params.id, req.params.blockerId]
    );

    await logTaskActivity(req.params.id, req.userId, 'dependency_removed', req.params.blockerId, null, { blocker_task_title: blocker.title });

    const dependencies = await getTaskDependencies(req.params.id, req.userId);
    res.json(dependencies);
  } catch (error) {
    console.error('Error removing task dependency:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users for mentions in task comments
router.get('/:id/mention-candidates', authenticateToken, async (req, res) => {
  try {
    // Validate task ID UUID format
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const task = await getAccessibleTask(req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const q = String(req.query?.q || '').trim();
    // Allow empty query to show all available users when just @ is typed

    const likeQuery = q.length > 0 ? `%${q}%` : '%';
    const startsWithQuery = q.length > 0 ? `${q}%` : '%';

    const result = await pool.query(
      `SELECT DISTINCT p.id, p.username, p.full_name, p.avatar_url,
              CASE WHEN p.username ILIKE $4 THEN 1 ELSE 2 END AS sort_order
       FROM profiles p
       JOIN tasks t ON t.id = $1
       JOIN projects proj ON proj.id = t.project_id
       LEFT JOIN project_shares ps
         ON ps.project_id = proj.id
        AND ps.shared_with_user_id = p.id
       WHERE p.id != $2
         AND (
           $3 = '%'
           OR p.username ILIKE $3
           OR COALESCE(p.full_name, '') ILIKE $3
         )
         AND (
           proj.user_id = p.id
           OR ps.shared_with_user_id IS NOT NULL
         )
       ORDER BY sort_order, p.username ASC
       LIMIT 10`,
      [req.params.id, req.userId, likeQuery, startsWithQuery]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error searching mention candidates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get activity feed for a task
router.get('/:id/activities', authenticateToken, async (req, res) => {
  try {
    // Validate task ID UUID format
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const task = await getAccessibleTask(req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const limit = safeParseInt(req.query.limit, 50, 1, 100);
    const offset = safeParseInt(req.query.offset, 0, 0);

    const result = await pool.query(
      `SELECT 
        ta.*,
        p.username AS user_username,
        p.full_name AS user_full_name,
        p.avatar_url AS user_avatar_url
       FROM task_activities ta
       LEFT JOIN profiles p ON p.id = ta.user_id
       WHERE ta.task_id = $1
       ORDER BY ta.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching task activities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get comments for a task
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    // Validate task ID UUID format
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const task = await getAccessibleTask(req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = await pool.query(
      `SELECT 
        tc.*,
        p.username AS user_username,
        p.full_name AS user_full_name,
        p.avatar_url AS user_avatar_url,
        (
          SELECT json_agg(json_build_object(
            'id', cm.id,
            'mentioned_user_id', cm.mentioned_user_id,
            'mentioned_username', mp.username,
            'mentioned_full_name', mp.full_name,
            'mentioned_avatar_url', mp.avatar_url
          ))
          FROM comment_mentions cm
          LEFT JOIN profiles mp ON mp.id = cm.mentioned_user_id
          WHERE cm.comment_id = tc.id
        ) AS mentions
       FROM task_comments tc
       LEFT JOIN profiles p ON p.id = tc.user_id
       WHERE tc.task_id = $1
       ORDER BY tc.created_at ASC`,
      [req.params.id]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching task comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a comment on a task
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    // Validate task ID UUID format
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const task = await getAccessibleTask(req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const access = await getProjectAccess(task.project_id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { content, parent_comment_id } = req.body;

    // Validate comment content
    const contentValidation = validateStringLength(content, 5000, false);
    if (!contentValidation.valid) {
      return res.status(400).json({ error: contentValidation.error || 'Comment content is required' });
    }

    // Validate parent_comment_id UUID format if provided
    if (parent_comment_id && !isValidUUID(parent_comment_id)) {
      return res.status(400).json({ error: 'Invalid parent comment ID format' });
    }

    if (parent_comment_id) {
      const parentCheck = await pool.query(
        `SELECT id FROM task_comments WHERE id = $1 AND task_id = $2`,
        [parent_comment_id, req.params.id]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
    }

    const commentResult = await pool.query(
      `INSERT INTO task_comments (task_id, user_id, content, parent_comment_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.id, req.userId, content.trim(), parent_comment_id || null]
    );

    const newComment = commentResult.rows[0];

    // Parse mentions from content (@username pattern)
    const mentionPattern = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionPattern.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    // Find user IDs for mentioned usernames
    if (mentions.length > 0) {
      const uniqueMentions = [...new Set(mentions)];
      const userResult = await pool.query(
        `SELECT id, username FROM profiles WHERE username = ANY($1::text[])`,
        [uniqueMentions]
      );

      for (const user of userResult.rows) {
        await pool.query(
          `INSERT INTO comment_mentions (comment_id, mentioned_user_id)
           VALUES ($1, $2)
           ON CONFLICT (comment_id, mentioned_user_id) DO NOTHING`,
          [newComment.id, user.id]
        );
      }
    }

    // Fetch the comment with user info and mentions
    const fullCommentResult = await pool.query(
      `SELECT 
        tc.*,
        p.username AS user_username,
        p.full_name AS user_full_name,
        p.avatar_url AS user_avatar_url,
        (
          SELECT json_agg(json_build_object(
            'id', cm.id,
            'mentioned_user_id', cm.mentioned_user_id,
            'mentioned_username', mp.username,
            'mentioned_full_name', mp.full_name,
            'mentioned_avatar_url', mp.avatar_url
          ))
          FROM comment_mentions cm
          LEFT JOIN profiles mp ON mp.id = cm.mentioned_user_id
          WHERE cm.comment_id = tc.id
        ) AS mentions
       FROM task_comments tc
       LEFT JOIN profiles p ON p.id = tc.user_id
       WHERE tc.id = $1`,
      [newComment.id]
    );

    await logTaskActivity(req.params.id, req.userId, 'updated', null, null, { action: 'comment_added', comment_id: newComment.id });

    res.status(201).json(fullCommentResult.rows[0]);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a comment
router.put('/:id/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    // Validate task ID and comment ID UUID formats
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }
    if (!isValidUUID(req.params.commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID format' });
    }

    const task = await getAccessibleTask(req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { content } = req.body;

    // Validate comment content
    const contentValidation = validateStringLength(content, 5000, false);
    if (!contentValidation.valid) {
      return res.status(400).json({ error: contentValidation.error || 'Comment content is required' });
    }

    const commentResult = await pool.query(
      `UPDATE task_comments
       SET content = $1, updated_at = NOW()
       WHERE id = $2 AND task_id = $3 AND user_id = $4
       RETURNING *`,
      [content.trim(), req.params.commentId, req.params.id, req.userId]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found or you do not have permission to edit it' });
    }

    // Update mentions
    await pool.query(
      `DELETE FROM comment_mentions WHERE comment_id = $1`,
      [req.params.commentId]
    );

    const mentionPattern = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionPattern.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    if (mentions.length > 0) {
      const uniqueMentions = [...new Set(mentions)];
      const userResult = await pool.query(
        `SELECT id, username FROM profiles WHERE username = ANY($1::text[])`,
        [uniqueMentions]
      );

      for (const user of userResult.rows) {
        await pool.query(
          `INSERT INTO comment_mentions (comment_id, mentioned_user_id)
           VALUES ($1, $2)
           ON CONFLICT (comment_id, mentioned_user_id) DO NOTHING`,
          [req.params.commentId, user.id]
        );
      }
    }

    const fullCommentResult = await pool.query(
      `SELECT 
        tc.*,
        p.username AS user_username,
        p.full_name AS user_full_name,
        p.avatar_url AS user_avatar_url,
        (
          SELECT json_agg(json_build_object(
            'id', cm.id,
            'mentioned_user_id', cm.mentioned_user_id,
            'mentioned_username', mp.username,
            'mentioned_full_name', mp.full_name,
            'mentioned_avatar_url', mp.avatar_url
          ))
          FROM comment_mentions cm
          LEFT JOIN profiles mp ON mp.id = cm.mentioned_user_id
          WHERE cm.comment_id = tc.id
        ) AS mentions
       FROM task_comments tc
       LEFT JOIN profiles p ON p.id = tc.user_id
       WHERE tc.id = $1`,
      [req.params.commentId]
    );

    res.json(fullCommentResult.rows[0]);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a comment
router.delete('/:id/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    // Validate task ID and comment ID UUID formats
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }
    if (!isValidUUID(req.params.commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID format' });
    }

    const task = await getAccessibleTask(req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const commentResult = await pool.query(
      `DELETE FROM task_comments
       WHERE id = $1 AND task_id = $2 AND user_id = $3
       RETURNING *`,
      [req.params.commentId, req.params.id, req.userId]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found or you do not have permission to delete it' });
    }

    await logTaskActivity(req.params.id, req.userId, 'updated', null, null, { action: 'comment_deleted', comment_id: req.params.commentId });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
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
      const canAccessProject = await hasProjectAccess(project_id, req.userId);
      if (!canAccessProject) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    // Check if GEMINI_API_KEY exists
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      return res.status(500).json({ error: 'AI service is not configured. Please check server configuration.' });
    }

    // Validate API key format (should start with AIza)
    const apiKey = process.env.GEMINI_API_KEY.trim();
    if (!apiKey.startsWith('AIza')) {
      console.error('GEMINI_API_KEY appears to be invalid (should start with AIza)');
      return res.status(500).json({ error: 'Invalid Gemini API key format. Please check your API key.' });
    }

    // Initialize Google Generative AI
    let genAI;
    let model;
    try {
      genAI = new GoogleGenerativeAI(apiKey);
      // Try gemini-2.5-flash, with fallback to gemini-1.5-flash if not available
      try {
        model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      } catch (modelError) {
        console.warn('gemini-2.5-flash not available, trying gemini-1.5-flash:', modelError.message);
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      }
    } catch (initError) {
      console.error('Failed to initialize Gemini API:', initError.message);
      return res.status(500).json({ error: `Failed to initialize AI service: ${initError.message}` });
    }

    // Create prompt for Gemini
    const aiPrompt = `Based on the following user request, generate a task with a title, description, and priority level.

User request: "${prompt.trim()}"

You MUST respond with ONLY a valid JSON object containing exactly these three fields:
{
  "title": "A clear and concise task title",
  "description": "A detailed description of the task",
  "priority": "low" | "medium" | "high"
}

Priority rules:
- "low" for non-urgent tasks
- "medium" for normal tasks
- "high" for urgent or important tasks

Return ONLY the JSON object, no markdown, no code blocks, no additional fields.`;

    // Generate content
    let result;
    let response;
    let text;
    try {
      result = await model.generateContent(aiPrompt);
      response = await result.response;
      text = response.text();
    } catch (apiError) {
      console.error('Gemini API error:', apiError.message);
      console.error('API error details:', JSON.stringify(apiError, null, 2));

      // Check for specific error types
      if (apiError.message?.includes('API_KEY_INVALID') || apiError.message?.includes('invalid API key')) {
        return res.status(500).json({ error: 'Invalid Gemini API key. Please check your API key configuration.' });
      }
      if (apiError.message?.includes('PERMISSION_DENIED') || apiError.message?.includes('permission')) {
        return res.status(500).json({ error: 'API key does not have required permissions. Please check your API key settings.' });
      }
      if (apiError.message?.includes('QUOTA') || apiError.message?.includes('quota')) {
        return res.status(500).json({ error: 'API quota exceeded. Please check your Gemini API usage limits.' });
      }

      return res.status(500).json({ error: `AI service error: ${apiError.message || 'Unknown error'}` });
    }

    // Clean up response text (remove markdown code blocks if present)
    text = text.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    }
    // Extract JSON object if there's extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }
    text = text.trim();

    // Parse JSON response
    let taskData;
    try {
      taskData = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse AI response. Raw text:', text.substring(0, 500));
      console.error('Parse error:', parseError.message);
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    }

    // Validate required fields
    if (!taskData.title || typeof taskData.title !== 'string') {
      console.error('AI response missing valid title. Response:', JSON.stringify(taskData));
      return res.status(500).json({ error: 'AI response missing valid title' });
    }

    // Validate and normalize priority (should already be valid due to schema, but double-check)
    const validPriorities = ['low', 'medium', 'high'];
    if (!taskData.priority || !validPriorities.includes(String(taskData.priority).toLowerCase())) {
      taskData.priority = 'medium';
    } else {
      taskData.priority = String(taskData.priority).toLowerCase();
    }

    // Ensure description exists (can be empty string)
    if (taskData.description === undefined || taskData.description === null) {
      taskData.description = '';
    }

    // Return the parsed task data
    res.json({
      title: String(taskData.title).trim(),
      description: String(taskData.description).trim() || null,
      priority: taskData.priority,
      project_id: project_id || null
    });
  } catch (error) {
    console.error('Unexpected error generating task with AI:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    // Provide more specific error messages
    let errorMessage = 'Failed to generate task. Please try again.';
    if (error.message) {
      errorMessage = error.message;
    }

    res.status(500).json({ error: errorMessage });
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
      recurrence_end_date,
      estimated_minutes,
      planned_for_date,
      plan_pinned
    } = req.body;

    if (!project_id && !parent_task_id) {
      return res.status(400).json({ error: 'Either Project ID or Parent Task ID is required' });
    }

    // Validate project_id UUID format if provided
    if (project_id && !isValidUUID(project_id)) {
      return res.status(400).json({ error: 'Invalid project ID format' });
    }

    // Validate parent_task_id UUID format if provided
    if (parent_task_id && !isValidUUID(parent_task_id)) {
      return res.status(400).json({ error: 'Invalid parent task ID format' });
    }

    // Validate title
    const titleValidation = validateStringLength(title, 500, false);
    if (!titleValidation.valid) {
      return res.status(400).json({ error: titleValidation.error || 'Task title is required' });
    }

    // Validate description length if provided
    if (description !== undefined && description !== null) {
      const descValidation = validateStringLength(description, 10000, true);
      if (!descValidation.valid) {
        return res.status(400).json({ error: descValidation.error });
      }
    }

    let projectId = project_id;
    let parentTaskId = parent_task_id || null;

    // If parent_task_id is provided, verify it exists and get its project_id
    if (parent_task_id) {
      const parentTask = await getAccessibleTask(parent_task_id, req.userId);
      if (!parentTask) {
        return res.status(404).json({ error: 'Parent task not found' });
      }

      projectId = parentTask.project_id;
      // Ensure parent_task_id is set
      parentTaskId = parent_task_id;
    }

    const access = await getProjectAccess(projectId, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!canCreateTask(access)) {
      return res.status(403).json({ error: 'You do not have permission to create tasks in this project' });
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
      (recurrence_interval !== undefined && recurrence_interval !== null && recurrence_interval !== '') ||
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

    const validEstimatedMinutes = normalizeEstimatedMinutes(estimated_minutes);
    if (Number.isNaN(validEstimatedMinutes)) {
      return res.status(400).json({ error: 'Estimated minutes must be a positive integer' });
    }

    const result = await pool.query(
      `INSERT INTO tasks (
        project_id, user_id, title, description, status, start_date, due_date, priority, parent_task_id, tags,
        recurrence_type, recurrence_interval, recurrence_end_date, estimated_minutes, planned_for_date, plan_pinned
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
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
        validRecurrenceEndDate,
        validEstimatedMinutes === undefined ? null : validEstimatedMinutes,
        planned_for_date || null,
        plan_pinned === true
      ]
    );

    const newTask = result.rows[0];
    await logTaskActivity(newTask.id, req.userId, 'created', null, null, { title: newTask.title });

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a task
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // Validate task ID UUID format
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    // Verify task exists and belongs to user
    const existingTaskRow = await getAccessibleTask(req.params.id, req.userId);
    if (!existingTaskRow) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check permissions
    const access = await getProjectAccess(existingTaskRow.project_id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (!canEditTask(access)) {
      return res.status(403).json({ error: 'You do not have permission to edit tasks in this project' });
    }

    const existingTask = { rows: [existingTaskRow] };

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
      recurrence_end_date,
      estimated_minutes,
      planned_for_date,
      plan_pinned
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
    let shouldUpdateEstimatedMinutes = false;
    let updatedEstimatedMinutes = null;
    let shouldUpdatePlannedForDate = false;
    let updatedPlannedForDate = null;
    let shouldUpdatePlanPinned = false;
    let updatedPlanPinned = false;

    if (title !== undefined) {
      const titleValidation = validateStringLength(title, 500, false);
      if (!titleValidation.valid) {
        return res.status(400).json({ error: titleValidation.error || 'Task title cannot be empty' });
      }
      updatedTitle = title.trim();
    }

    if (description !== undefined) {
      shouldUpdateDescription = true;
      const descValidation = validateStringLength(description, 10000, true);
      if (!descValidation.valid) {
        return res.status(400).json({ error: descValidation.error });
      }
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
               AND t.status != 'done'
             ORDER BY t.created_at ASC`,
            [req.params.id]
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
        // Validate parent_task_id UUID format
        if (!isValidUUID(parent_task_id)) {
          return res.status(400).json({ error: 'Invalid parent task ID format' });
        }
        // Verify parent task exists and belongs to user
        const parentCheck = await pool.query(
          `SELECT t.id
           FROM tasks t
           JOIN projects p ON p.id = t.project_id
           LEFT JOIN project_shares ps
             ON ps.project_id = p.id
            AND ps.shared_with_user_id = $2
           WHERE t.id = $1
             AND (p.user_id = $2 OR ps.shared_with_user_id IS NOT NULL)
           LIMIT 1`,
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

    if (estimated_minutes !== undefined) {
      const parsedEstimatedMinutes = normalizeEstimatedMinutes(estimated_minutes);
      if (Number.isNaN(parsedEstimatedMinutes)) {
        return res.status(400).json({ error: 'Estimated minutes must be a positive integer' });
      }
      shouldUpdateEstimatedMinutes = true;
      updatedEstimatedMinutes = parsedEstimatedMinutes;
    }

    if (planned_for_date !== undefined) {
      shouldUpdatePlannedForDate = true;
      updatedPlannedForDate = planned_for_date || null;
    }

    if (plan_pinned !== undefined) {
      shouldUpdatePlanPinned = true;
      updatedPlanPinned = plan_pinned === true;
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
    if (shouldUpdateEstimatedMinutes) {
      updateFields.push(`estimated_minutes = $${paramIndex++}`);
      updateValues.push(updatedEstimatedMinutes);
    }
    if (shouldUpdatePlannedForDate) {
      updateFields.push(`planned_for_date = $${paramIndex++}`);
      updateValues.push(updatedPlannedForDate);
    }
    if (shouldUpdatePlanPinned) {
      updateFields.push(`plan_pinned = $${paramIndex++}`);
      updateValues.push(updatedPlanPinned);
    }

    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    queryText = `
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++}
        AND project_id IN (
          SELECT p.id
          FROM projects p
          LEFT JOIN project_shares ps
            ON ps.project_id = p.id
           AND ps.shared_with_user_id = $${paramIndex}
          WHERE p.user_id = $${paramIndex}
             OR ps.shared_with_user_id IS NOT NULL
        )
      RETURNING *
    `;

    updateValues.push(req.params.id, req.userId);

    const result = await pool.query(queryText, updateValues);

    const previousTask = existingTask.rows[0];
    const updatedTask = result.rows[0];

    // Log activities for changed fields
    if (updatedTitle !== null && updatedTitle !== previousTask.title) {
      await logTaskActivity(req.params.id, req.userId, 'title_changed', previousTask.title, updatedTitle);
    }
    if (shouldUpdateDescription && updatedDescription !== previousTask.description) {
      await logTaskActivity(req.params.id, req.userId, 'description_changed', previousTask.description || '', updatedDescription || '');
    }
    if (updatedStatus !== null && updatedStatus !== previousTask.status) {
      await logTaskActivity(req.params.id, req.userId, 'status_changed', previousTask.status, updatedStatus);
    }
    if (shouldUpdateStartDate && String(updatedStartDate || '') !== String(previousTask.start_date || '')) {
      await logTaskActivity(req.params.id, req.userId, 'start_date_changed', previousTask.start_date || '', updatedStartDate || '');
    }
    if (shouldUpdateDueDate && String(updatedDueDate || '') !== String(previousTask.due_date || '')) {
      await logTaskActivity(req.params.id, req.userId, 'due_date_changed', previousTask.due_date || '', updatedDueDate || '');
    }
    if (updatedPriority !== null && updatedPriority !== previousTask.priority) {
      await logTaskActivity(req.params.id, req.userId, 'priority_changed', previousTask.priority, updatedPriority);
    }
    if (updatedTags !== null) {
      const oldTags = Array.isArray(previousTask.tags) ? previousTask.tags : [];
      const parseResult = safeJsonParse(updatedTags, []);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid tags format: ' + parseResult.error });
      }
      const newTags = parseResult.data;
      if (!Array.isArray(newTags)) {
        return res.status(400).json({ error: 'Tags must be an array' });
      }
      const addedTags = newTags.filter(t => !oldTags.includes(t));
      const removedTags = oldTags.filter(t => !newTags.includes(t));
      addedTags.forEach(tag => {
        logTaskActivity(req.params.id, req.userId, 'tag_added', null, tag);
      });
      removedTags.forEach(tag => {
        logTaskActivity(req.params.id, req.userId, 'tag_removed', tag, null);
      });
    }
    if (shouldUpdateParentTaskId && String(updatedParentTaskId || '') !== String(previousTask.parent_task_id || '')) {
      if (updatedParentTaskId) {
        await logTaskActivity(req.params.id, req.userId, 'updated', null, null, {
          field: 'parent_task_id',
          action: 'made_subtask',
          parent_task_id: updatedParentTaskId
        });
      } else {
        await logTaskActivity(req.params.id, req.userId, 'updated', null, null, {
          field: 'parent_task_id',
          action: 'removed_from_parent'
        });
      }
    }
    if (shouldUpdateEstimatedMinutes && updatedEstimatedMinutes !== previousTask.estimated_minutes) {
      await logTaskActivity(req.params.id, req.userId, 'updated',
        previousTask.estimated_minutes ? `${previousTask.estimated_minutes} minutes` : 'Not set',
        updatedEstimatedMinutes ? `${updatedEstimatedMinutes} minutes` : 'Not set',
        { field: 'estimated_minutes' }
      );
    }
    if (shouldUpdatePlannedForDate && String(updatedPlannedForDate || '') !== String(previousTask.planned_for_date || '')) {
      await logTaskActivity(req.params.id, req.userId, 'updated',
        previousTask.planned_for_date || 'Not set',
        updatedPlannedForDate || 'Not set',
        { field: 'planned_for_date' }
      );
    }
    if (shouldUpdatePlanPinned && updatedPlanPinned !== previousTask.plan_pinned) {
      await logTaskActivity(req.params.id, req.userId, 'updated', null, null, {
        field: 'plan_pinned',
        action: updatedPlanPinned ? 'pinned_to_plan' : 'unpinned_from_plan'
      });
    }
    if (shouldUpdateRecurrenceType) {
      const oldRecurrence = previousTask.recurrence_type
        ? `${previousTask.recurrence_interval || 1} ${previousTask.recurrence_type}`
        : 'None';
      const newRecurrence = updatedRecurrenceType
        ? `${updatedRecurrenceInterval || 1} ${updatedRecurrenceType}`
        : 'None';
      await logTaskActivity(req.params.id, req.userId, 'updated', oldRecurrence, newRecurrence, {
        field: 'recurrence'
      });
    }
    if (updatedPosition !== null && updatedPosition !== previousTask.position) {
      await logTaskActivity(req.params.id, req.userId, 'updated', null, null, {
        field: 'position',
        action: 'moved_in_kanban'
      });
    }

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
          `UPDATE tasks
           SET last_generated_at = NOW()
           WHERE id = $1
             AND project_id IN (
               SELECT p.id
               FROM projects p
               LEFT JOIN project_shares ps
                 ON ps.project_id = p.id
                AND ps.shared_with_user_id = $2
               WHERE p.user_id = $2 OR ps.shared_with_user_id IS NOT NULL
             )`,
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
    // Validate task ID UUID format
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    // First check if task exists and get project access
    const existingTaskRow = await getAccessibleTask(req.params.id, req.userId);
    if (!existingTaskRow) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check permissions
    const access = await getProjectAccess(existingTaskRow.project_id, req.userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (!canDeleteTask(access)) {
      return res.status(403).json({ error: 'You do not have permission to delete tasks in this project' });
    }

    const result = await pool.query(
      `DELETE FROM tasks
       WHERE id = $1
         AND project_id IN (
           SELECT p.id
           FROM projects p
           LEFT JOIN project_shares ps
             ON ps.project_id = p.id
            AND ps.shared_with_user_id = $2
           WHERE p.user_id = $2 OR ps.shared_with_user_id IS NOT NULL
         )
       RETURNING *`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const deletedTask = result.rows[0];
    await logTaskActivity(req.params.id, req.userId, 'deleted', null, null, { title: deletedTask.title });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

