import logger from '../logger.js';

/**
 * Origin whitelist utilities for CORS and email link validation.
 *
 * Configuration via environment variable:
 *   ALLOWED_ORIGINS - Comma-separated list of allowed origins
 *   Example: "https://example.com,https://www.example.com"
 *
 * In development (NODE_ENV !== 'production'), localhost origins are allowed by default.
 * In production, ALLOWED_ORIGINS must be explicitly set.
 */

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:6173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:6173',
];

let cachedOrigins: string[] | null = null;

/**
 * Parse ALLOWED_ORIGINS env var into array.
 * Results are cached after first call.
 *
 * @returns Array of allowed origin URLs (no trailing slashes)
 */
export function getAllowedOrigins(): string[] {
  if (cachedOrigins !== null) {
    return cachedOrigins;
  }

  const envOrigins = process.env.ALLOWED_ORIGINS;

  if (envOrigins) {
    cachedOrigins = envOrigins
      .split(',')
      .map((o) => o.trim().replace(/\/$/, '')) // Normalize: trim and remove trailing slash
      .filter(Boolean);

    logger.info(
      `[origins] Loaded ${cachedOrigins.length} allowed origins from ALLOWED_ORIGINS`
    );
    return cachedOrigins;
  }

  // Development fallback
  if (process.env.NODE_ENV !== 'production') {
    cachedOrigins = DEV_ORIGINS;
    logger.info(
      `[origins] Development mode: allowing localhost origins (${DEV_ORIGINS.length} entries)`
    );
    return cachedOrigins;
  }

  // Production with no ALLOWED_ORIGINS = empty (fail-secure)
  logger.warn(
    '[origins] ALLOWED_ORIGINS not set in production - all origins will be rejected'
  );
  cachedOrigins = [];
  return cachedOrigins;
}

/**
 * Validate origin against whitelist.
 *
 * @param origin - Origin URL to validate (e.g., "https://example.com")
 * @returns The normalized origin if valid, null otherwise
 */
export function validateOrigin(origin: string | undefined): string | null {
  if (!origin) {
    return null;
  }

  const allowed = getAllowedOrigins();
  const normalized = origin.replace(/\/$/, ''); // Remove trailing slash

  if (allowed.includes(normalized)) {
    return normalized;
  }

  logger.warn(`[origins] Rejected origin: ${origin}`);
  return null;
}

/**
 * Check if an origin is allowed (boolean version of validateOrigin).
 *
 * @param origin - Origin URL to check
 * @returns true if origin is in whitelist, false otherwise
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  return validateOrigin(origin) !== null;
}

/**
 * Clear cached origins (useful for testing).
 */
export function clearOriginsCache(): void {
  cachedOrigins = null;
}