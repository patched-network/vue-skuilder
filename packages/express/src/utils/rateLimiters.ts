import rateLimit from 'express-rate-limit';
import logger from '../logger.js';

/**
 * Shared rate limiters for Express routes.
 *
 * Configuration can be overridden via environment variables:
 *   - RATE_LIMIT_GLOBAL_MAX: Max requests per minute globally (default: 100)
 *   - RATE_LIMIT_STRICT_MAX: Max requests per 15 min for strict endpoints (default: 5)
 *   - RATE_LIMIT_MODERATE_MAX: Max requests per 15 min for moderate endpoints (default: 30)
 */

const GLOBAL_WINDOW_MS = 60 * 1000; // 1 minute
const STANDARD_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Global rate limiter - applies to all requests.
 * Generous limit to catch abuse without affecting normal usage.
 * Default: 100 requests per minute per IP.
 */
export const globalLimiter = rateLimit({
  windowMs: GLOBAL_WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please slow down.' },
  handler: (req, res, _next, options) => {
    logger.warn(`[rate-limit] Global limit exceeded for ${req.ip} on ${req.method} ${req.path}`);
    res.status(429).json(options.message);
  },
  // Skip rate limiting for health check endpoints
  skip: (req) => req.path === '/' || req.path === '/version',
});

/**
 * Strict rate limiter - for sensitive endpoints.
 * Use for: email-sending, token-consuming, password operations.
 * Default: 5 requests per 15 minutes per IP.
 */
export const strictLimiter = rateLimit({
  windowMs: STANDARD_WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_STRICT_MAX || '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please try again later.' },
  handler: (req, res, _next, options) => {
    logger.warn(`[rate-limit] Strict limit exceeded for ${req.ip} on ${req.path}`);
    res.status(429).json(options.message);
  },
});

/**
 * Moderate rate limiter - for authenticated/general endpoints.
 * Use for: status checks, authenticated operations, API calls.
 * Default: 30 requests per 15 minutes per IP.
 */
export const moderateLimiter = rateLimit({
  windowMs: STANDARD_WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_MODERATE_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please try again later.' },
  handler: (req, res, _next, options) => {
    logger.warn(`[rate-limit] Moderate limit exceeded for ${req.ip} on ${req.path}`);
    res.status(429).json(options.message);
  },
});