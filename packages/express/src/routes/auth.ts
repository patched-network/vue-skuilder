import express, { Request, Response } from 'express';
import {
  findUserByUsername,
  findUserByToken,
  findUserByEmail,
  getUserEmail,
  updateUserDoc,
} from '../couchdb/userLookup.js';
import { generateSecureToken, getTokenExpiry, isTokenExpired } from '../utils/tokens.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.js';
import logger from '../logger.js';

const router = express.Router();

/**
 * POST /auth/send-verification
 * Trigger verification email for a newly created account.
 *
 * Body params:
 *   - username: string (required)
 *   - email: string (optional) - If provided, uses this email directly (avoids DB sync race condition)
 *   - origin: string (optional) - Frontend origin URL for constructing verification link
 */
router.post('/send-verification', (req: Request, res: Response) => {
  void (async () => {
    try {
    const { username, email: providedEmail, origin } = req.body;

    if (!username) {
      return res.status(400).json({ ok: false, error: 'Username required' });
    }

    // Get user doc
    const userDoc = await findUserByUsername(username);
    if (!userDoc) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    // Use provided email if available, otherwise lookup in database
    let email = providedEmail;
    if (!email) {
      email = await getUserEmail(username);
      if (!email) {
        return res.status(400).json({
          ok: false,
          error: 'No email found for user. Please provide email during registration.',
        });
      }
    }

    // Generate verification token (24 hour expiry)
    const token = generateSecureToken();
    const expiresAt = getTokenExpiry(24);

    // Update user doc with token and email (for password reset lookup)
    userDoc.verificationToken = token;
    userDoc.verificationTokenExpiresAt = expiresAt;
    userDoc.status = 'pending_verification';

    // Save email to _users doc if not already present (enables findUserByEmail)
    if (email && !userDoc.email) {
      userDoc.email = email as string;
    }

    await updateUserDoc(userDoc);

    // Send verification email with origin for link construction
    await sendVerificationEmail(email, token, origin);

    logger.info(`Verification email sent to ${username} at ${email}`);
    res.json({ ok: true });
    } catch (error) {
      logger.error('Error sending verification email:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to send verification email',
      });
    }
  })();
});

/**
 * POST /auth/verify
 * Complete email verification using token.
 */
router.post('/verify', (req: Request, res: Response) => {
  void (async () => {
    try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ ok: false, error: 'Token required' });
    }

    // Find user by verification token
    const userDoc = await findUserByToken(token, 'verification');
    if (!userDoc) {
      return res.status(404).json({ ok: false, error: 'Invalid or expired token' });
    }

    // Check token expiry
    if (
      userDoc.verificationTokenExpiresAt &&
      isTokenExpired(userDoc.verificationTokenExpiresAt)
    ) {
      return res.status(400).json({ ok: false, error: 'Token has expired' });
    }

    // Update user status
    userDoc.status = 'verified';
    userDoc.verificationToken = null;
    userDoc.verificationTokenExpiresAt = null;

    await updateUserDoc(userDoc);

    logger.info(`User ${userDoc.name} verified successfully`);
    res.json({ ok: true, username: userDoc.name });
    } catch (error) {
      logger.error('Error verifying email:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to verify email',
      });
    }
  })();
});

/**
 * POST /auth/request-reset
 * Request password reset email.
 *
 * Body params:
 *   - email: string (required)
 *   - origin: string (optional) - Frontend origin URL for constructing reset link
 */
router.post('/request-reset', (req: Request, res: Response) => {
  void (async () => {
    try {
    const { email, origin } = req.body;

    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email required' });
    }

    // Find user by email (using design doc view)
    const userDoc = await findUserByEmail(email);
    if (!userDoc) {
      // Don't reveal whether email exists (security best practice)
      logger.warn(`Password reset requested for non-existent email: ${email}`);
      return res.json({ ok: true }); // Return success anyway
    }

    // Generate reset token (1 hour expiry)
    const token = generateSecureToken();
    const expiresAt = getTokenExpiry(1);

    // Update user doc with reset token
    userDoc.passwordResetToken = token;
    userDoc.passwordResetTokenExpiresAt = expiresAt;

    await updateUserDoc(userDoc);

    // Send password reset email with origin for link construction
    await sendPasswordResetEmail(email, token, origin);

    logger.info(`Password reset email sent to ${userDoc.name} at ${email}`);
    res.json({ ok: true });
    } catch (error) {
      logger.error('Error requesting password reset:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to send password reset email',
      });
    }
  })();
});

/**
 * POST /auth/reset-password
 * Reset password using token.
 */
router.post('/reset-password', (req: Request, res: Response) => {
  void (async () => {
    try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ ok: false, error: 'Token and new password required' });
    }

    // Find user by reset token
    const userDoc = await findUserByToken(token, 'reset');
    if (!userDoc) {
      return res.status(404).json({ ok: false, error: 'Invalid or expired token' });
    }

    // Check token expiry
    if (
      userDoc.passwordResetTokenExpiresAt &&
      isTokenExpired(userDoc.passwordResetTokenExpiresAt)
    ) {
      return res.status(400).json({ ok: false, error: 'Token has expired' });
    }

    // Update password in CouchDB
    // CouchDB has an internal hook that automatically hashes the password
    // when a 'password' field is present in the user document.
    // see https://docs.couchdb.org/en/stable/intro/security.html#password-changing
    
    
    // @ts-expect-error writing to metadata field here.
    userDoc.password = newPassword as string; // Add plain text password field

    // Clear reset token
    userDoc.passwordResetToken = null;
    userDoc.passwordResetTokenExpiresAt = null;

    await updateUserDoc(userDoc);

    logger.info(`Password reset completed for ${userDoc.name}`);
    res.json({
      ok: true,
    });
    } catch (error) {
      logger.error('Error resetting password:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to reset password',
      });
    }
  })();
});

export default router;
