// server/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');
const pool = require('../db/connection');
const { safeParseInt } = require('../utils/validation');

// PostgreSQL store for express-rate-limit
class PostgresStore {
  constructor() {
    this.pool = pool;
  }

  async increment(key) {
    const client = await this.pool.connect();
    try {
      const windowMs = 5 * 60 * 1000; // 5 minutes
      const now = new Date();
      const resetTime = new Date(now.getTime() + windowMs);

      // Try to get existing record
      const result = await client.query(
        'SELECT hits, reset_time FROM rate_limits WHERE key = $1',
        [key]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const resetTimeDate = new Date(row.reset_time);

        // If reset time has passed, reset the counter
        if (resetTimeDate <= now) {
          await client.query(
            'UPDATE rate_limits SET hits = 1, reset_time = $1 WHERE key = $2',
            [resetTime, key]
          );
          return {
            totalHits: 1,
            resetTime: resetTime,
          };
        } else {
          // Increment existing counter (safely parse hits value)
          const currentHits = safeParseInt(row.hits, 0, 0);
          const newHits = currentHits + 1;
          await client.query(
            'UPDATE rate_limits SET hits = $1 WHERE key = $2',
            [newHits, key]
          );
          return {
            totalHits: newHits,
            resetTime: resetTimeDate,
          };
        }
      } else {
        // Create new record
        await client.query(
          'INSERT INTO rate_limits (key, hits, reset_time) VALUES ($1, 1, $2)',
          [key, resetTime]
        );
        return {
          totalHits: 1,
          resetTime: resetTime,
        };
      }
    } catch (error) {
      console.error('PostgreSQL rate limit error:', error.message);
      // On error, allow the request (fail open)
      return {
        totalHits: 1,
        resetTime: new Date(Date.now() + 5 * 60 * 1000),
      };
    } finally {
      client.release();
    }
  }

  async decrement(key) {
    const client = await this.pool.connect();
    try {
      await client.query(
        'UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = $1',
        [key]
      );
    } catch (error) {
      console.error('PostgreSQL rate limit decrement error:', error.message);
      // Ignore decrement errors
    } finally {
      client.release();
    }
  }

  async resetKey(key) {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM rate_limits WHERE key = $1', [key]);
    } catch (error) {
      console.error('PostgreSQL rate limit reset error:', error.message);
      // Ignore reset errors
    } finally {
      client.release();
    }
  }

  async shutdown() {
    // PostgreSQL pool handles its own cleanup
  }
}

// Create rate limiter for AI endpoints
// Limits: 5 requests per 5 minutes per user
const createAIRateLimiter = () => {
  const store = new PostgresStore();

  return rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: parseInt(process.env.AI_RATE_LIMIT_MAX || '5', 10), // 5 requests per window
    message: {
      error: 'Too many AI generation requests. Please try again in 5 minutes.',
      retryAfter: 5 * 60, // seconds
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    store: store,
    keyGenerator: (req) => {
      // Use user ID from authenticated request
      return `ai_rate_limit:${req.userId || req.ip}`;
    },
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json(options.message);
    },
  });
};

module.exports = createAIRateLimiter;
