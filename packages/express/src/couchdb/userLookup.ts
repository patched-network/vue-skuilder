import Nano from 'nano';
import type { CouchDbUserDoc, UserConfig } from '@vue-skuilder/db';
import { getCouchDB } from './index.js';
import logger from '../logger.js';
import { isNanoError } from '../utils/types.js';

/**
 * User lookup utilities for authentication flows.
 * Provides helper functions to query _users DB and user databases.
 */

/**
 * Get the _users database instance.
 */
function getUsersDB(): Nano.DocumentScope<CouchDbUserDoc> {
  return getCouchDB().use<CouchDbUserDoc>('_users');
}

/**
 * Get a user's personal database instance.
 */
function getUserDB<T = unknown>(username: string): Nano.DocumentScope<T> {
  const userDbName = `userdb-${hexEncode(username)}`;
  return getCouchDB().use<T>(userDbName);
}

/**
 * Convert string to hex encoding (for userdb naming).
 * @param str - String to encode (typically username)
 * @throws Error if string exceeds maximum safe length
 */
function hexEncode(str: string): string {
  // Prevent DoS via extremely long usernames
  // CouchDB usernames are typically limited to 256 chars, but we'll be more restrictive
  const MAX_USERNAME_LENGTH = 256;

  if (str.length > MAX_USERNAME_LENGTH) {
    throw new Error(
      `Username exceeds maximum length of ${MAX_USERNAME_LENGTH} characters`
    );
  }

  let hex: string;
  let returnStr: string = '';
  const len = str.length; // Cache length to avoid repeated property access

  for (let i = 0; i < len; i++) {
    hex = str.charCodeAt(i).toString(16);
    returnStr += ('000' + hex).slice(-4);
  }

  return returnStr;
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
 * Get user's email from their personal database CONFIG document.
 */
export async function getUserEmail(username: string): Promise<string | null> {
  try {
    const userDB = getUserDB<{ email?: string }>(username);
    const configDoc = await userDB.get('CONFIG');

    if (configDoc && typeof configDoc === 'object' && 'email' in configDoc) {
      return (configDoc as unknown as UserConfig).email || null;
    }

    return null;
  } catch (error: unknown) {
    if (isNanoError(error) && error.statusCode === 404) {
      logger.warn(`No CONFIG doc found for user ${username}`);
      return null;
    }
    logger.error(`Error getting email for user ${username}:`, error);
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
