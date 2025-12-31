import logger from '../logger.js';
import { validateOrigin } from '../utils/origins.js';

/**
 * Email service for sending verification and password reset emails.
 *
 * Integrated with business-backend mailer service running on port 3001.
 * Requires MAILER_AUTH_TOKEN env var for authentication with mailer service.
 */

const MAILER_SERVICE_URL =
  process.env.MAILER_SERVICE_URL || 'http://localhost:3001/mailer';
const MAILER_AUTH_TOKEN = process.env.MAILER_AUTH_TOKEN;

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (MAILER_AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${MAILER_AUTH_TOKEN}`;
  } else {
    logger.warn('[email] MAILER_AUTH_TOKEN not set - requests may be rejected');
  }
  return headers;
}

/**
 * Send verification email with magic link token.
 * @param to - Recipient email address
 * @param token - Verification token to include in link
 * @param origin - Optional frontend origin URL (e.g., 'https://course.example.com')
 *                 Must be in ALLOWED_ORIGINS whitelist.
 *                 If not provided or invalid, falls back to APP_URL env var.
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
  origin?: string
): Promise<void> {
  // Validate origin against whitelist (returns null if invalid/missing)
  const validatedOrigin = validateOrigin(origin);

  // Priority: validated origin > APP_URL env var
  const baseUrl = validatedOrigin || process.env.APP_URL;

  if (!baseUrl) {
    const error =
      'No valid origin for email link. Set APP_URL or provide a whitelisted origin.';
    logger.error(`[email] ${error}`);
    throw new Error(error);
  }

  const verificationLink = `${baseUrl}/verify?token=${token}`;

  try {
    const payload = {
      recipientEmail: to,
      recipientName: to.split('@')[0], // Extract name from email (simple approach)
      magicLink: verificationLink,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
    };

    const response = await fetch(`${MAILER_SERVICE_URL}/send-verification`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Mailer service error: ${error.error || response.statusText}`
      );
    }

    logger.info(`[email] Verification email sent to ${to} via mailer service`);
  } catch (error) {
    logger.error(`[email] Failed to send verification email to ${to}:`, error);
    throw error;
  }
}

/**
 * Send password reset email with magic link token.
 * @param to - Recipient email address
 * @param token - Reset token to include in link
 * @param origin - Optional frontend origin URL (e.g., 'https://course.example.com')
 *                 Must be in ALLOWED_ORIGINS whitelist.
 *                 If not provided or invalid, falls back to APP_URL env var.
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
  origin?: string
): Promise<void> {
  // Validate origin against whitelist (returns null if invalid/missing)
  const validatedOrigin = validateOrigin(origin);

  // Priority: validated origin > APP_URL env var
  const baseUrl = validatedOrigin || process.env.APP_URL;

  if (!baseUrl) {
    const error =
      'No valid origin for email link. Set APP_URL or provide a whitelisted origin.';
    logger.error(`[email] ${error}`);
    throw new Error(error);
  }

  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  try {
    const response = await fetch(`${MAILER_SERVICE_URL}/send-password-reset`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        recipientEmail: to,
        recipientName: to.split('@')[0], // Extract name from email (simple approach)
        magicLink: resetLink,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Mailer service error: ${error.error || response.statusText}`
      );
    }

    logger.info(
      `[email] Password reset email sent to ${to} via mailer service`
    );
  } catch (error) {
    logger.error(
      `[email] Failed to send password reset email to ${to}:`,
      error
    );

    throw error;
  }
}