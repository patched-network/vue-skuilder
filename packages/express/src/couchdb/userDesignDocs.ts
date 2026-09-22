/**
 * Design documents for _users database.
 * Provides views for efficient user lookups by email and tokens.
 */

import Nano from 'nano';
import { getCouchDB } from './index.js';
import logger from '../logger.js';
import { isNanoError } from '../utils/types.js';

/**
 * Design document for user lookups in _users database.
 */
export const usersDesignDoc = {
  _id: '_design/users',
  views: {
    /**
     * Index users by email address. Keys are normalized (trim + lowercase, see
     * utils/email.ts normalizeEmail) so lookups are case-insensitive even for
     * addresses stored before normalization was introduced.
     */
    by_email: {
      map: `function(doc) {
        if (doc.type === 'user' && typeof doc.email === 'string' && doc.email) {
          emit(doc.email.trim().toLowerCase(), doc._id);
        }
      }`,
    },
    /**
     * Index *verified* users by email address. Backs the "at most one verified
     * account per email" invariant enforced at POST /auth/verify.
     * The _count reduce also serves the pre-enable audit: query with
     * ?group=true and look for any value > 1 to find pre-existing duplicates.
     */
    by_verified_email: {
      map: `function(doc) {
        if (doc.type === 'user' && typeof doc.email === 'string' && doc.email && doc.status === 'verified') {
          emit(doc.email.trim().toLowerCase(), doc._id);
        }
      }`,
      reduce: '_count',
    },
    /**
     * Index users by verification token.
     */
    by_verification_token: {
      map: `function(doc) {
        if (doc.type === 'user' && doc.verificationToken) {
          emit(doc.verificationToken, doc._id);
        }
      }`,
    },
    /**
     * Index users by password reset token.
     */
    by_reset_token: {
      map: `function(doc) {
        if (doc.type === 'user' && doc.passwordResetToken) {
          emit(doc.passwordResetToken, doc._id);
        }
      }`,
    },
  },
  language: 'javascript',
};

/**
 * Apply design documents to _users database.
 * Safe to call multiple times - will only update if changed.
 */
export async function applyUsersDesignDocs(): Promise<void> {
  try {
    const usersDB = getCouchDB().use('_users');

    // Try to get existing design doc
    let existingDoc: Nano.DocumentGetResponse | null = null;
    try {
      existingDoc = await usersDB.get(usersDesignDoc._id);
    } catch (error: unknown) {
      if (isNanoError(error) && error.statusCode !== 404) {
        throw error;
      }
      // Doc doesn't exist, will create new
    }

    // Prepare doc with _rev if updating
    const docToInsert = existingDoc
      ? { ...usersDesignDoc, _rev: existingDoc._rev }
      : usersDesignDoc;

    await usersDB.insert(docToInsert);
    logger.info(
      `Applied design doc ${usersDesignDoc._id} to _users database` +
        (existingDoc ? ' (updated)' : ' (created)')
    );
  } catch (error) {
    logger.error('Error applying _users design documents:', error);
    throw error;
  }
}
