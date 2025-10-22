import express, { Request, Response } from 'express';
import Nano from 'nano';
import { getCouchURLWithProtocol } from '../couchdb/index.js';
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

interface CouchSession {
  info: {
    authenticated: string;
    authentication_db: string;
    authentication_handlers: string[];
  };
  ok: boolean;
  userCtx: {
    name: string;
    roles: string[];
  };
}

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
 * GET /auth/status
 * Get current user's account status (verification status, email).
 * Requires AuthSession cookie.
 */
router.get('/status', (req: Request, res: Response) => {
  void (async () => {
    try {
      const authCookie: string = req.cookies?.AuthSession;
      if (!authCookie) {
        return res.status(401).json({ ok: false, error: 'Not authenticated' });
      }

      // Verify session with CouchDB to get username
      const session: CouchSession = await Nano({
        cookie: 'AuthSession=' + authCookie,
        url: getCouchURLWithProtocol(),
      }).session();

      const username = session.userCtx.name;
      if (!username) {
        return res.status(401).json({ ok: false, error: 'Invalid session' });
      }

      // Use admin credentials to read user's status from _users
      const userDoc = await findUserByUsername(username);
      if (!userDoc) {
        return res.status(404).json({ ok: false, error: 'User not found' });
      }

      res.json({
        ok: true,
        username: userDoc.name,
        status: userDoc.status || 'pending_verification', // Default to pending if not explicitly set
        email: userDoc.email || null,
      });
    } catch (error) {
      logger.error('Error fetching user status:', error);
      res.status(500).json({ ok: false, error: 'Failed to fetch user status' });
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

/**
 * POST /auth/permissions
 * Grant or update course permissions for a user (called by payment webhooks)
 *
 * Body params:
 *   - userId: string (required) - CouchDB username
 *   - courseId: string (required) - Course identifier
 *   - action: 'grant_access' (required)
 *   - provider: string (optional) - 'stripe', 'manual', etc.
 *   - metadata: object (optional) - Additional payment metadata
 */
router.post('/permissions', (req: Request, res: Response) => {
  void (async () => {
    try {
      // Verify authorization
      const authHeader = req.headers.authorization;
      const expectedAuth = `Bearer ${process.env.PERMISSIONS_SECRET}`;

      if (!authHeader || authHeader !== expectedAuth) {
        logger.warn('Unauthorized permissions request');
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const { userId, courseId, action, provider, metadata } = req.body;

      // Validate required fields
      if (!userId || !courseId || !action) {
        return res.status(400).json({
          ok: false,
          error: 'Missing required fields: userId, courseId, action'
        });
      }

      if (action !== 'grant_access') {
        return res.status(400).json({
          ok: false,
          error: 'Invalid action. Only "grant_access" is supported.'
        });
      }

      // Find user in _users db
      const userDoc = await findUserByUsername(userId);
      if (!userDoc) {
        logger.error(`Permissions request for non-existent user: ${userId}`);
        return res.status(404).json({ ok: false, error: 'User not found' });
      }

      // Initialize entitlements if not present
      if (!userDoc.entitlements) {
        userDoc.entitlements = {};
      }

      // Get existing entitlement (preserve registrationDate if exists)
      const existingEntitlement = userDoc.entitlements[courseId];

      // Update to paid status
      userDoc.entitlements[courseId] = {
        status: 'paid',
        registrationDate: existingEntitlement?.registrationDate || new Date().toISOString(),
        purchaseDate: new Date().toISOString(),
        // No expires field for paid users
      };

      // Save to _users db
      await updateUserDoc(userDoc);

      logger.info(`Granted ${courseId} access to user ${userId} via ${provider || 'unknown'}`);

      res.json({
        ok: true,
        message: `Access granted to ${courseId} for user ${userId}`
      });

    } catch (error) {
      logger.error('Error granting permissions:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to grant permissions',
      });
    }
  })();
});

export default router;
