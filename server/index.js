// server/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Validate required environment variables
const validateEnvVariables = () => {
  const requiredVars = [
    'SUPABASE_JWT_SECRET',
    'DATABASE_URL'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease set these environment variables before starting the server.');
    console.error('You can create a .env file in the server directory with these variables.');
    process.exit(1);
  }

  // Validate that DATABASE_URL is not empty
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() === '') {
    console.error('❌ DATABASE_URL is set but empty. Please provide a valid database connection string.');
    process.exit(1);
  }

  // Validate that SUPABASE_JWT_SECRET is not empty
  if (process.env.SUPABASE_JWT_SECRET && process.env.SUPABASE_JWT_SECRET.trim() === '') {
    console.error('❌ SUPABASE_JWT_SECRET is set but empty. Please provide a valid JWT secret.');
    process.exit(1);
  }
};

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration - allow Authorization header
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Explicitly allow localhost:3000 for local development
    const allowedOrigins = [
      'http://localhost:3000',
      process.env.FRONTEND_URL,
      'http://localhost:3001',
      'https://orderedpm.onrender.com',
      'https://ordered-pm.vercel.app',     // Add your deployed frontend URL here
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' })); // Limit JSON payloads to 1MB
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const profileRoutes = require('./routes/profiles');

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/profiles', profileRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Database health check route
const pool = require('./db/connection');
app.get('/api/health/db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'healthy',
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log full error for debugging (server-side only)
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.userId || 'anonymous'
  });
  
  // Don't expose stack traces to clients
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'development' 
    ? err.message 
    : 'An error occurred. Please try again later.';
    
  res.status(statusCode).json({ 
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const startServer = () => {
  validateEnvVariables();

  return app.listen(PORT, () => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Server is running on port ${PORT}`);
    }
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };