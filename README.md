# OrderedPM

A modern, full-stack project management and team collaboration tool built with React, Express.js, and PostgreSQL.

## Features

- 🔐 User authentication (Sign up/Sign in with Supabase)
- 📁 Project management (Create, Read, Update, Delete projects)
- ✅ Task management (Create, Read, Update, Delete tasks)
- 📊 Task status tracking (To Do, In Progress, Done)
- 🎨 Modern, responsive UI/UX
- 🚀 Ready for deployment (Vercel + Render)

## Tech Stack

- **Frontend**: React, React Router
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **Hosting**: Vercel (Frontend), Render (Backend)

## Quick Start

See [SETUP.md](./SETUP.md) for detailed setup and deployment instructions.

### Local Development

1. **Set up the database**:
   - Create a Supabase project
   - Run the SQL schema from `server/db/schema.sql` in Supabase SQL Editor

2. **Backend**:
   ```bash
   cd server
   npm install
   cp .env.example .env
   # Edit .env with your Supabase credentials
   npm run dev
   ```

3. **Frontend**:
   ```bash
   cd client
   npm install
   cp .env.example .env
   # Edit .env with your backend URL
   npm start
   ```

## Project Structure

```
OrderedPM/
├── client/          # React frontend application
├── server/          # Express.js backend API
└── SETUP.md         # Detailed setup guide
```

## License

See [LICENSE](./LICENSE) file for details.
