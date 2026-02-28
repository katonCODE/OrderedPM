// server/db/connection.js
const { Pool } = require('pg');
require('dotenv').config();

// Determine SSL configuration
// Supabase and most cloud databases require SSL in production
const requiresSSL = process.env.DATABASE_URL?.includes('supabase') ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  process.env.DATABASE_URL?.includes('render.com') ||
  process.env.NODE_ENV === 'production';

// Render free tier has connection limits, so use smaller pool
const isRender = process.env.RENDER || process.env.DATABASE_URL?.includes('render.com');
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: requiresSSL ? { rejectUnauthorized: false } : false,
  max: isRender ? 5 : 20, // Smaller pool for Render free tier
  min: isRender ? 0 : 2, // Don't keep idle connections on Render
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 60000, // Increased to 60 seconds for cold starts
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // Send keep-alive after 10 seconds
};

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Connected to PostgreSQL database');
  }
});

pool.on('error', (err) => {
  // Only log non-timeout errors to avoid noise
  // Timeout errors are expected on Render during cold starts
  if (err.code !== 'ETIMEDOUT' && err.message?.includes('timeout') === false) {
    console.error('Unexpected error on idle database client', err);
  }
  // Don't exit - let the pool handle reconnection
  // Only exit if it's a critical configuration error
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    console.error('Critical database connection error - check DATABASE_URL');
  }
});

module.exports = pool;

