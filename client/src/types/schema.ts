/**
 * Database schema types for OrderedPM
 * Based on Supabase PostgreSQL schema
 */

// Enums
export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum TaskRecurrenceType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

// User type (from Supabase Auth)
export interface User {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  [key: string]: unknown;
}

// Project type
export interface Project {
  id: string; // UUID
  user_id: string; // UUID
  name: string;
  description: string | null;
  created_at: string; // ISO timestamp string
  updated_at: string; // ISO timestamp string
}

// Task type
export interface Task {
  id: string; // UUID
  project_id: string; // UUID
  user_id: string; // UUID
  title: string;
  description: string | null;
  status: TaskStatus;
  start_date: string | null; // ISO date string (YYYY-MM-DD)
  due_date: string | null; // ISO date string (YYYY-MM-DD)
  priority: TaskPriority;
  position: number | null; // DOUBLE PRECISION for kanban ordering
  parent_task_id: string | null; // UUID reference to parent task (null for top-level tasks)
  tags: string[];
  recurrence_type: TaskRecurrenceType | null;
  recurrence_interval: number | null;
  recurrence_end_date: string | null; // ISO date string (YYYY-MM-DD)
  last_generated_at: string | null; // ISO timestamp string
  estimated_minutes: number | null;
  planned_for_date: string | null; // ISO date string (YYYY-MM-DD)
  plan_pinned: boolean;
  created_at: string; // ISO timestamp string
  updated_at: string; // ISO timestamp string
  // Computed fields (not in DB, added by frontend/backend)
  subtasks?: Task[]; // Array of child tasks
  completed_subtasks?: number; // Count of completed subtasks
  total_subtasks?: number; // Total count of subtasks
  blocked_by_count?: number; // Count of tasks this task depends on
  blocking_count?: number; // Count of tasks blocked by this task
  creator_username?: string | null;
  creator_full_name?: string | null;
  creator_avatar_url?: string | null;
}

// Type helpers for creating/updating entities
export type CreateProjectInput = Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type UpdateProjectInput = Partial<Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type CreateTaskInput = Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'position' | 'subtasks' | 'completed_subtasks' | 'total_subtasks'> & {
  position?: number | null;
  parent_task_id?: string | null;
};
export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'project_id' | 'user_id' | 'created_at' | 'updated_at' | 'subtasks' | 'completed_subtasks' | 'total_subtasks'>> & {
  position?: number | null;
  parent_task_id?: string | null;
};

// Activity types
export enum TaskActivityType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  STATUS_CHANGED = 'status_changed',
  DUE_DATE_CHANGED = 'due_date_changed',
  START_DATE_CHANGED = 'start_date_changed',
  PRIORITY_CHANGED = 'priority_changed',
  TITLE_CHANGED = 'title_changed',
  DESCRIPTION_CHANGED = 'description_changed',
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
  SHARED = 'shared',
  UNSHARED = 'unshared',
  DEPENDENCY_ADDED = 'dependency_added',
  DEPENDENCY_REMOVED = 'dependency_removed',
  TAG_ADDED = 'tag_added',
  TAG_REMOVED = 'tag_removed',
}

export interface TaskActivity {
  id: string; // UUID
  task_id: string; // UUID
  user_id: string; // UUID
  activity_type: TaskActivityType;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string; // ISO timestamp string
  user_username?: string | null;
  user_full_name?: string | null;
  user_avatar_url?: string | null;
}

// Comment types
export interface CommentMention {
  id: string; // UUID
  mentioned_user_id: string; // UUID
  mentioned_username?: string | null;
  mentioned_full_name?: string | null;
  mentioned_avatar_url?: string | null;
}

export interface TaskComment {
  id: string; // UUID
  task_id: string; // UUID
  user_id: string; // UUID
  parent_comment_id: string | null; // UUID reference to parent comment (null for top-level comments)
  content: string;
  created_at: string; // ISO timestamp string
  updated_at: string; // ISO timestamp string
  user_username?: string | null;
  user_full_name?: string | null;
  user_avatar_url?: string | null;
  mentions?: CommentMention[] | null;
}

export type CreateCommentInput = {
  content: string;
  parent_comment_id?: string | null;
};

export type UpdateCommentInput = {
  content: string;
};

