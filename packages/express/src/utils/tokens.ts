import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token for verification or password reset.
 * Returns a 64-character hexadecimal string (32 bytes).
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate token expiry time from now.
 * @param hours - Number of hours until expiry
 * @returns ISO 8601 timestamp string
 */
export function getTokenExpiry(hours: number): string {
  const expiryTime = new Date(Date.now() + hours * 60 * 60 * 1000);
  return expiryTime.toISOString();
}

/**
 * Check if a token has expired.
 * @param expiryTimestamp - ISO 8601 timestamp string
 * @returns true if expired, false otherwise
 */
export function isTokenExpired(expiryTimestamp: string): boolean {
  const expiryTime = new Date(expiryTimestamp);
  return Date.now() > expiryTime.getTime();
}
