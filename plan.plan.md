<!-- f90c62f4-31bd-443f-b9a1-e93f2bc3abd6 370972d0-92b9-48db-b6c1-1d5237436c64 -->
# OrderedPM Development Plan

## Overview

Build a simple but complete project management tool demonstrating full-stack development skills. The application will allow users to create projects, add tasks to projects, and manage their work in a clean, modern interface.

## Tech Stack Decisions

- **Frontend**: React (already set up) → Deploy to Vercel
- **Backend**: Express.js (already set up) → Deploy to Render
- **Database**: Supabase PostgreSQL (includes auth + database)
- **Authentication**: Supabase Auth (integrated with database)

## Project Structure

### Database Schema (Supabase)

1. **users** table (handled by Supabase Auth)
2. **projects** table

- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- name (text)
- description (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)

3. **tasks** table

- id (uuid, primary key)
- project_id (uuid, foreign key to projects)
- user_id (uuid, foreign key to auth.users)
- title (text)
- description (text, nullable)
- status (text: 'todo', 'in_progress', 'done')
- created_at (timestamp)
- updated_at (timestamp)

### Backend Implementation (`server/`)

**Files to create/modify:**

- `server/index.js` - Expand Express server with routes
- `server/routes/auth.js` - Authentication routes (login, register, get user)
- `server/routes/projects.js` - Project CRUD operations
- `server/routes/tasks.js` - Task CRUD operations
- `server/db/connection.js` - PostgreSQL connection pool using Supabase connection string
- `server/middleware/auth.js` - JWT verification middleware (using Supabase JWT)
- `server/.env.example` - Environment variables template
- `server/.gitignore` - Ensure .env is ignored

**Key features:**

- RESTful API endpoints for projects and tasks
- JWT authentication using Supabase tokens
- Row Level Security (RLS) enforcement at API level
- Error handling middleware
- CORS configuration for frontend

### Frontend Implementation (`client/`)

**Files to create/modify:**

- `client/src/App.js` - Main app with routing and auth state
- `client/src/components/Login.js` - Login/Register form
- `client/src/components/Dashboard.js` - Main dashboard showing projects
- `client/src/components/ProjectList.js` - List of user's projects
- `client/src/components/ProjectForm.js` - Create/Edit project form
- `client/src/components/TaskList.js` - Tasks for a project
- `client/src/components/TaskForm.js` - Create/Edit task form
- `client/src/services/api.js` - API service layer for backend calls
- `client/src/services/auth.js` - Authentication service
- `client/src/App.css` - Modern, clean styling

**Key features:**

- User authentication (login/register)
- Protected routes
- Project management (create, read, update, delete)
- Task management (create, read, update, delete, status changes)
- Responsive design
- Loading states and error handling

### Configuration Files

**Backend:**

- Update `server/package.json` - Add any missing dependencies (jsonwebtoken for JWT verification)
- Create `server/.env` - Environment variables (not committed)
- Create `server/.env.example` - Template for environment variables

**Frontend:**

- Update `client/package.json` - Add react-router-dom for routing
- Create `client/.env` - Environment variables for API URL (not committed)
- Create `client/.env.example` - Template for environment variables

### Deployment Setup

**Supabase:**

1. Create Supabase project
2. Set up database schema (projects and tasks tables)
3. Configure Row Level Security (RLS) policies
4. Get connection string and JWT secret

**Render (Backend):**

1. Connect GitHub repository
2. Set build command: `cd server && npm install`
3. Set start command: `cd server && node index.js`
4. Add environment variables (DATABASE_URL, SUPABASE_JWT_SECRET, PORT)

**Vercel (Frontend):**

1. Connect GitHub repository
2. Set root directory to `client`
3. Build command: `npm install && npm run build`
4. Add environment variable (REACT_APP_API_URL)

## Implementation Steps

1. **Database Setup**

- Create Supabase project
- Design and create database schema
- Set up RLS policies
- Test connection from local backend

2. **Backend Development**

- Set up database connection pool
- Implement authentication middleware
- Create project routes (GET, POST, PUT, DELETE)
- Create task routes (GET, POST, PUT, DELETE)
- Add error handling and validation

3. **Frontend Development**

- Set up routing structure
- Create authentication components
- Build project management UI
- Build task management UI
- Implement API service layer
- Add styling and responsive design

4. **Testing & Polish**

- Test all CRUD operations
- Test authentication flow
- Fix bugs and improve UX
- Add loading states and error messages

5. **Deployment**

- Deploy backend to Render
- Deploy frontend to Vercel
- Configure environment variables
- Test deployed application

## Key Files Reference

**Backend:**

- `server/index.js` - Main Express server
- `server/db/connection.js` - Database connection
- `server/middleware/auth.js` - JWT verification
- `server/routes/projects.js` - Project endpoints
- `server/routes/tasks.js` - Task endpoints

**Frontend:**

- `client/src/App.js` - Main app component with routing
- `client/src/services/api.js` - API calls
- `client/src/components/Dashboard.js` - Main dashboard
- `client/src/components/ProjectList.js` - Projects display
- `client/src/components/TaskList.js` - Tasks display