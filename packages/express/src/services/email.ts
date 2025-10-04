import logger from '../logger.js';

/**
 * Email service for sending verification and password reset emails.
 *
 * Current implementation: Console logging stub
 * TODO: Integrate with email provider (SendGrid, AWS SES, Resend, etc.)
 */

/**
 * Send verification email with magic link token.
 */
export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const verificationLink = `${appUrl}/verify?token=${token}`;

  // TODO: Replace with actual email service
  logger.info(`
====================================
VERIFICATION EMAIL (STUB)
To: ${to}
Subject: Verify your Vue-Skuilder account
Link: ${verificationLink}
====================================
  `);

  console.log(`\n📧 VERIFICATION EMAIL\nTo: ${to}\nLink: ${verificationLink}\n`);
}

/**
 * Send password reset email with magic link token.
 */
export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const resetLink = `${appUrl}/reset-password?token=${token}`;

  // TODO: Replace with actual email service
  logger.info(`
====================================
PASSWORD RESET EMAIL (STUB)
To: ${to}
Subject: Reset your Vue-Skuilder password
Link: ${resetLink}
====================================
  `);

  console.log(`\n📧 PASSWORD RESET EMAIL\nTo: ${to}\nLink: ${resetLink}\n`);
}

/**
 * Future email provider integration example:
 *
 * import { SendGrid } from '@sendgrid/mail';
 *
 * const sg = new SendGrid(process.env.SENDGRID_API_KEY);
 *
 * export async function sendVerificationEmail(to: string, token: string): Promise<void> {
 *   await sg.send({
 *     to,
 *     from: 'noreply@vue-skuilder.com',
 *     subject: 'Verify your account',
 *     html: `<a href="${appUrl}/verify?token=${token}">Click here to verify</a>`
 *   });
 * }
 */
