import logger from '../logger.js';

/**
 * Email service for sending verification and password reset emails.
 *
 * Integrated with business-backend mailer service running on port 3001
 */

const MAILER_SERVICE_URL =
  process.env.MAILER_SERVICE_URL || 'http://localhost:3001/mailer';

/**
 * Send verification email with magic link token.
 * @param to - Recipient email address
 * @param token - Verification token to include in link
 * @param origin - Optional frontend origin URL (e.g., 'https://course.example.com')
 *                 If not provided, falls back to APP_URL env var or localhost
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
  origin?: string
): Promise<void> {
  // Priority: origin param > APP_URL env var > localhost fallback
  const baseUrl = origin || process.env.APP_URL || 'http://localhost:5173';
  const verificationLink = `${baseUrl}/verify?token=${token}`;

  try {
    const response = await fetch(`${MAILER_SERVICE_URL}/send-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientEmail: to,
        recipientName: to.split('@')[0], // Extract name from email (simple approach)
        magicLink: verificationLink,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Mailer service error: ${error.error || response.statusText}`
      );
    }

    logger.info(`Verification email sent to ${to} via mailer service`);
  } catch (error) {
    logger.error(`Failed to send verification email to ${to}:`, error);

    throw error;
  }
}

/**
 * Send password reset email with magic link token.
 * @param to - Recipient email address
 * @param token - Reset token to include in link
 * @param origin - Optional frontend origin URL (e.g., 'https://course.example.com')
 *                 If not provided, falls back to APP_URL env var or localhost
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
  origin?: string
): Promise<void> {
  // Priority: origin param > APP_URL env var > localhost fallback
  const baseUrl = origin || process.env.APP_URL || 'http://localhost:5173';
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  try {
    const response = await fetch(`${MAILER_SERVICE_URL}/send-password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    logger.info(`Password reset email sent to ${to} via mailer service`);
  } catch (error) {
    logger.error(`Failed to send password reset email to ${to}:`, error);

    throw error;
  }
}
