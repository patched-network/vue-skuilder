import Nano from 'nano';
import type { CouchDbUserDoc } from '@vue-skuilder/db';
import { getCouchDB } from './index.js';
import logger from '../logger.js';
import { isNanoError } from '../utils/types.js';

/**
 * User lookup utilities for authentication flows.
 * Provides helper functions to query the _users DB.
 */

/**
 * Get the _users database instance.
 */
function getUsersDB(): Nano.DocumentScope<CouchDbUserDoc> {
  return getCouchDB().use<CouchDbUserDoc>('_users');
}

/**
 * Find user document by username.
 */
export async function findUserByUsername(
  username: string
): Promise<CouchDbUserDoc | null> {
  try {
    const usersDB = getUsersDB();
    const docId = `org.couchdb.user:${username}`;
    const userDoc = await usersDB.get(docId);
    return userDoc;
  } catch (error: unknown) {
    if (isNanoError(error) && error.statusCode === 404) {
      return null;
    }
    logger.error(`Error finding user by username ${username}:`, error);
    throw error;
  }
}

/**
 * Find user by verification or password reset token using design doc views.
 */
export async function findUserByToken(
  token: string,
  tokenType: 'verification' | 'reset'
): Promise<CouchDbUserDoc | null> {
  try {
    const usersDB = getUsersDB();
    const viewName =
      tokenType === 'verification' ? 'by_verification_token' : 'by_reset_token';

    const result = await usersDB.view('users', viewName, {
      key: token,
      include_docs: true,
      limit: 1,
    });

    if (result.rows.length > 0 && result.rows[0].doc) {
      return result.rows[0].doc as CouchDbUserDoc;
    }

    return null;
  } catch (error: unknown) {
    if (isNanoError(error) && error.statusCode === 404) {
      logger.warn(`Design doc or view not found for ${tokenType} token lookup`);
      return null;
    }
    logger.error(`Error finding user by ${tokenType} token:`, error);
    throw error;
  }
}

/**
 * Find user by email using design doc view.
 */
export async function findUserByEmail(
  email: string
): Promise<CouchDbUserDoc | null> {
  try {
    const usersDB = getUsersDB();

    const result = await usersDB.view('users', 'by_email', {
      key: email,
      include_docs: true,
      limit: 1,
    });

    if (result.rows.length > 0 && result.rows[0].doc) {
      return result.rows[0].doc as CouchDbUserDoc;
    }

    return null;
  } catch (error: unknown) {
    if (isNanoError(error) && error.statusCode === 404) {
      logger.warn('Design doc or view not found for email lookup');
      return null;
    }
    logger.error(`Error finding user by email ${email}:`, error);
    throw error;
  }
}

/**
 * Find a *verified* user by email using the by_verified_email view.
 * Used to enforce the "at most one verified account per email" invariant.
 * Note: the view carries a _count reduce, so reduce:false is required to read
 * the underlying rows/docs rather than the aggregate.
 */
export async function findVerifiedUserByEmail(
  email: string
): Promise<CouchDbUserDoc | null> {
  try {
    const usersDB = getUsersDB();

    const result = await usersDB.view('users', 'by_verified_email', {
      key: email,
      include_docs: true,
      reduce: false,
      limit: 1,
    });

    if (result.rows.length > 0 && result.rows[0].doc) {
      return result.rows[0].doc as CouchDbUserDoc;
    }

    return null;
  } catch (error: unknown) {
    if (isNanoError(error) && error.statusCode === 404) {
      // View not built yet (e.g. immediately post-deploy). Fail open — the
      // pre-enable audit and later verifications still catch duplicates.
      logger.warn('Design doc or view not found for verified email lookup');
      return null;
    }
    logger.error(`Error finding verified user by email ${email}:`, error);
    throw error;
  }
}

/**
 * Update user document in _users database.
 */
export async function updateUserDoc(userDoc: CouchDbUserDoc): Promise<void> {
  try {
    const usersDB = getUsersDB();
    await usersDB.insert(userDoc);
    logger.info(`Updated user doc for ${userDoc.name}`);
  } catch (error) {
    logger.error(`Error updating user doc for ${userDoc.name}:`, error);
    throw error;
  }
}
