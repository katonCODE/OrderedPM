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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_no_self_parent CHECK (
        parent_task_id != id
        OR parent_task_id IS NULL
    )
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
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
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
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
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