// server/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');
const { Redis } = require('@upstash/redis');

// Initialize Redis client if credentials are provided
let redisClient = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// Custom Redis store for express-rate-limit
class UpstashRedisStore {
  constructor(client) {
    this.client = client;
  }

  async increment(key) {
    const count = await this.client.incr(key);
    const ttl = await this.client.ttl(key);
    if (ttl === -1) {
      // Set expiration if key doesn't have one (5 minutes)
      await this.client.expire(key, 300);
    }
    return {
      totalHits: count,
      resetTime: new Date(Date.now() + (ttl > 0 ? ttl * 1000 : 300 * 1000)),
    };
  }

  async decrement(key) {
    await this.client.decr(key);
  }

  async resetKey(key) {
    await this.client.del(key);
  }

  async shutdown() {
    // Upstash REST API doesn't need connection cleanup
  }
}

// Create rate limiter for AI endpoints
// Limits: 5 requests per 5 minutes per user
const createAIRateLimiter = () => {
  const store = redisClient ? new UpstashRedisStore(redisClient) : undefined;

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
    skip: (req) => {
      // Skip rate limiting if Redis is not configured (fallback to no limit)
      // In production, you might want to return false here to enforce limits
      return !redisClient;
    },
  });
};

module.exports = createAIRateLimiter;
