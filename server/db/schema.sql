-- OrderedPM Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS project_shares (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (project_id, shared_with_user_id)
);
-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    due_date DATE,
    start_date DATE,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    position DOUBLE PRECISION,
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    recurrence_type TEXT CHECK (
        recurrence_type IN ('daily', 'weekly', 'monthly')
    ),
    recurrence_interval INTEGER DEFAULT 1 CHECK (
        recurrence_interval IS NULL
        OR recurrence_interval >= 1
    ),
    recurrence_end_date DATE,
    last_generated_at TIMESTAMP WITH TIME ZONE,
    estimated_minutes INTEGER CHECK (
        estimated_minutes IS NULL
        OR estimated_minutes >= 1
    ),
    planned_for_date DATE,
    plan_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_no_self_parent CHECK (
        parent_task_id != id
        OR parent_task_id IS NULL
    )
);
CREATE TABLE IF NOT EXISTS task_dependencies (
    blocked_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    blocker_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (blocked_task_id, blocker_task_id),
    CONSTRAINT check_no_self_dependency CHECK (blocked_task_id != blocker_task_id)
);
CREATE TABLE IF NOT EXISTS focus_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    planned_minutes INTEGER NOT NULL CHECK (planned_minutes >= 1),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    actual_minutes INTEGER CHECK (
        actual_minutes IS NULL
        OR actual_minutes >= 0
    ),
    outcome TEXT CHECK (
        outcome IS NULL
        OR outcome IN ('completed', 'progress', 'blocked', 'cancelled')
    ),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT bio_length_limit CHECK (
        bio IS NULL
        OR length(bio) <= 1000
    )
);
-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived);
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_shared_with_user_id ON project_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_planned_for_date ON tasks(planned_for_date);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_blocked_task_id ON task_dependencies(blocked_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_blocker_task_id ON task_dependencies(blocker_task_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id ON focus_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at ON focus_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ language 'plpgsql';
-- Create triggers to automatically update updated_at
CREATE TRIGGER update_projects_updated_at BEFORE
UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE
UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE
UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$ BEGIN
INSERT INTO public.profiles (id, username)
VALUES (
        NEW.id,
        'user_' || substr(NEW.id::text, 1, 8)
    );
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Trigger to auto-create profile on user signup
CREATE TRIGGER on_auth_user_created
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- RLS Policies for projects
-- Users can only see their own projects
CREATE POLICY "Users can view their own projects" ON projects FOR
SELECT USING (auth.uid() = user_id);
-- Users can create their own projects
CREATE POLICY "Users can create their own projects" ON projects FOR
INSERT WITH CHECK (auth.uid() = user_id);
-- Users can update their own projects
CREATE POLICY "Users can update their own projects" ON projects FOR
UPDATE USING (auth.uid() = user_id);
-- Users can delete their own projects
CREATE POLICY "Users can delete their own projects" ON projects FOR DELETE USING (auth.uid() = user_id);
-- RLS Policies for project_shares
CREATE POLICY "Users can view project shares for accessible projects" ON project_shares FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = project_shares.project_id
                AND (
                    p.user_id = auth.uid()
                    OR project_shares.shared_with_user_id = auth.uid()
                )
        )
    );
CREATE POLICY "Project owners can create project shares" ON project_shares FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = project_shares.project_id
                AND p.user_id = auth.uid()
        )
    );
CREATE POLICY "Project owners can delete project shares" ON project_shares FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM projects p
        WHERE p.id = project_shares.project_id
            AND p.user_id = auth.uid()
    )
);
-- RLS Policies for tasks
-- Users can only see tasks from their own projects
CREATE POLICY "Users can view their own tasks" ON tasks FOR
SELECT USING (auth.uid() = user_id);
-- Users can create tasks in their own projects
CREATE POLICY "Users can create their own tasks" ON tasks FOR
INSERT WITH CHECK (auth.uid() = user_id);
-- Users can update their own tasks
CREATE POLICY "Users can update their own tasks" ON tasks FOR
UPDATE USING (auth.uid() = user_id);
-- Users can delete their own tasks
CREATE POLICY "Users can delete their own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);
-- RLS Policies for task_dependencies
CREATE POLICY "Users can view their own task dependencies" ON task_dependencies FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM tasks t
            WHERE t.id = task_dependencies.blocked_task_id
                AND t.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can create their own task dependencies" ON task_dependencies FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM tasks t1
            WHERE t1.id = task_dependencies.blocked_task_id
                AND t1.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1
            FROM tasks t2
            WHERE t2.id = task_dependencies.blocker_task_id
                AND t2.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can delete their own task dependencies" ON task_dependencies FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM tasks t
        WHERE t.id = task_dependencies.blocked_task_id
            AND t.user_id = auth.uid()
    )
);
-- RLS Policies for focus_sessions
CREATE POLICY "Users can view their own focus sessions" ON focus_sessions FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own focus sessions" ON focus_sessions FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own focus sessions" ON focus_sessions FOR
UPDATE USING (auth.uid() = user_id);
-- RLS Policies for profiles
-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON profiles FOR
SELECT USING (auth.uid() = id);
-- Users can view public profiles
CREATE POLICY "Users can view public profiles" ON profiles FOR
SELECT USING (true);
-- Users can create their own profile
CREATE POLICY "Users can create their own profile" ON profiles FOR
INSERT WITH CHECK (auth.uid() = id);
-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON profiles FOR
UPDATE USING (auth.uid() = id);
-- Users can delete their own profile
CREATE POLICY "Users can delete their own profile" ON profiles FOR DELETE USING (auth.uid() = id);