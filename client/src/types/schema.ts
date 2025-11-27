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
  due_date: string | null; // ISO date string (YYYY-MM-DD)
  priority: TaskPriority;
  position: number | null; // DOUBLE PRECISION for kanban ordering
  created_at: string; // ISO timestamp string
  updated_at: string; // ISO timestamp string
}

// Type helpers for creating/updating entities
export type CreateProjectInput = Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type UpdateProjectInput = Partial<Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type CreateTaskInput = Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'position'> & {
  position?: number | null;
};
export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'project_id' | 'user_id' | 'created_at' | 'updated_at'>> & {
  position?: number | null;
};

