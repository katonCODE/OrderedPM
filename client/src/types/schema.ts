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

