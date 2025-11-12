# OrderedPM Setup Guide

This guide will help you set up and deploy OrderedPM, a full-stack project management tool.

## Prerequisites

- Node.js (v14 or higher)
- A Supabase account (free tier)
- A GitHub account (for deployment)

## Step 1: Database Setup (Supabase)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once your project is created, go to the SQL Editor
3. Copy and paste the contents of `server/db/schema.sql` into the SQL Editor and run it
4. Go to Project Settings > API and note down:
   - Your JWT Secret
   - Your Database connection string (under Connection String > URI)

## Step 2: Backend Setup

1. Navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your Supabase credentials:
   ```
   DATABASE_URL=your_supabase_connection_string
   SUPABASE_JWT_SECRET=your_jwt_secret
   PORT=5000
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

   Or for production:
   ```bash
   npm start
   ```

## Step 3: Frontend Setup

1. Navigate to the `client` directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your backend URL:
   ```
   REACT_APP_API_URL=http://localhost:5000
   ```

   For production, also add:
   ```
   REACT_APP_SUPABASE_URL=https://your-project.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
   ```

5. Start the development server:
   ```bash
   npm start
   ```

## Step 4: Deploy Backend to Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) and sign up/login
3. Click "New +" and select "Web Service"
4. Connect your GitHub repository
5. Configure the service:
   - **Name**: orderedpm-backend (or your preferred name)
   - **Root Directory**: server
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Environment Variables**:
     - `DATABASE_URL`: Your Supabase connection string
     - `SUPABASE_JWT_SECRET`: Your Supabase JWT secret
     - `PORT`: 10000 (Render sets this automatically, but you can specify)
6. Click "Create Web Service"
7. Once deployed, copy your backend URL (e.g., `https://orderedpm-backend.onrender.com`)

## Step 5: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "New Project"
3. Import your GitHub repository
4. Configure the project:
   - **Root Directory**: client
   - **Framework Preset**: Create React App
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: build
   - **Environment Variables**:
     - `REACT_APP_API_URL`: Your Render backend URL (e.g., `https://orderedpm-backend.onrender.com`)
     - `REACT_APP_SUPABASE_URL`: Your Supabase project URL
     - `REACT_APP_SUPABASE_ANON_KEY`: Your Supabase anon key
5. Click "Deploy"

## Step 6: Update CORS (if needed)

If you encounter CORS issues, update `server/index.js` to include your Vercel frontend URL:

```javascript
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend.vercel.app']
}));
```

## Testing the Application

1. Start both backend and frontend servers locally
2. Open `http://localhost:3000` in your browser
3. Create an account (sign up)
4. Create a project
5. Add tasks to your project
6. Test updating and deleting projects and tasks

## Troubleshooting

### Database Connection Issues
- Verify your `DATABASE_URL` is correct
- Check that your Supabase project is active
- Ensure the database schema has been created

### Authentication Issues
- Verify `SUPABASE_JWT_SECRET` matches your Supabase project settings
- Check that Supabase Auth is enabled in your project
- Ensure environment variables are set correctly in production

### CORS Issues
- Make sure your backend CORS configuration includes your frontend URL
- Check that environment variables are set correctly in production

### Build Issues
- Ensure all dependencies are installed
- Check Node.js version compatibility
- Review build logs for specific errors

## Project Structure

```
OrderedPM/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API service layer
│   │   └── App.js          # Main app component
│   └── package.json
├── server/                 # Express backend
│   ├── routes/             # API routes
│   ├── middleware/         # Auth middleware
│   ├── db/                 # Database connection & schema
│   └── index.js            # Server entry point
└── README.md
```

## Features

- User authentication (Sign up/Sign in)
- Project management (Create, Read, Update, Delete)
- Task management (Create, Read, Update, Delete)
- Task status tracking (To Do, In Progress, Done)
- Responsive design
- Modern UI/UX

## Tech Stack

- **Frontend**: React, React Router
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **Hosting**: Vercel (Frontend), Render (Backend)

