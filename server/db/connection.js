// server/db/connection.js
const { Pool } = require('pg');
require('dotenv').config();

// Determine SSL configuration
// Supabase and most cloud databases require SSL in production
const requiresSSL = process.env.DATABASE_URL?.includes('supabase') ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  process.env.DATABASE_URL?.includes('render.com') ||
  process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: requiresSSL ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  min: 2, // Minimum number of idle clients to keep warm
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 30000, // Return an error after 30 seconds if connection could not be established
});

pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Connected to PostgreSQL database');
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  // Log to monitoring service (e.g., Sentry) if available
  // Don't exit - let the pool handle reconnection
  // Only exit if it's a critical configuration error
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    console.error('Critical database connection error - check DATABASE_URL');
    // Consider graceful shutdown with health check endpoint
    // For now, log and let the application continue
  }
});

module.exports = pool;

