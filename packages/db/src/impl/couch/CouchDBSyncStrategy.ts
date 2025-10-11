// packages/db/src/impl/couch/CouchDBSyncStrategy.ts

import { ENV } from '@db/factory';
import { GuestUsername } from '../../core/types/types-legacy';
import { logger } from '../../util/logger';
import { Status } from '@vue-skuilder/common';
import type { SyncStrategy } from '../common/SyncStrategy';
import type { AccountCreationResult, AuthenticationResult } from '../common/types';
import { getLocalUserDB, hexEncode, updateGuestAccountExpirationDate, accomodateGuest } from '../common';
import pouch from './pouchdb-setup';
import { createPouchDBConfig } from './index';
import { getLoggedInUsername } from './auth';

const log = (s: any) => {
  logger.info(s);
};

/**
 * Sync strategy that implements full CouchDB remote synchronization
 * Handles account creation, authentication, and live sync with remote CouchDB server
 */
export class CouchDBSyncStrategy implements SyncStrategy {
  private syncHandle?: any; // Handle to cancel sync if needed

  setupRemoteDB(username: string): PouchDB.Database {
    if (username === GuestUsername || username.startsWith(GuestUsername)) {
      // For guest users, remote is same as local (no remote sync)
      return getLocalUserDB(username);
    } else {
      // For real users, connect to remote CouchDB
      return this.getUserDB(username);
    }
  }

  getWriteDB(username: string): PouchDB.Database {
    if (username === GuestUsername || username.startsWith(GuestUsername)) {
      // Guest users write to local database
      return getLocalUserDB(username);
    } else {
      // Authenticated users write to remote (which will sync to local)
      return this.getUserDB(username);
    }
  }

  startSync(localDB: PouchDB.Database, remoteDB: PouchDB.Database): void {
    // Only sync if local and remote are different instances
    if (localDB !== remoteDB) {
      this.syncHandle = pouch.sync(localDB, remoteDB, {
        live: true,
        retry: true,
      });
    }
    // If they're the same (guest mode), no sync needed
  }

  stopSync?(): void {
    if (this.syncHandle) {
      this.syncHandle.cancel();
      this.syncHandle = undefined;
    }
  }

  canCreateAccount(): boolean {
    return true;
  }

  canAuthenticate(): boolean {
    return true;
  }

  async createAccount(username: string, password: string): Promise<AccountCreationResult> {
    // IMPORTANT: Capture funnel username BEFORE any operations that might change session state
    const funnelUsername = await this.getCurrentUsername();
    const isFunnelAccount = funnelUsername.startsWith(GuestUsername);

    if (isFunnelAccount) {
      logger.info(`Creating account for funnel user ${funnelUsername} -> ${username}`);
    }

    try {
      const signupRequest = await this.getRemoteCouchRootDB().signUp(username, password);

      if (signupRequest.ok) {
        log(`CREATEACCOUNT: Successfully created account for ${username}`);

        // Log out any existing session
        try {
          const logoutResult = await this.getRemoteCouchRootDB().logOut();
          log(`CREATEACCOUNT: logged out: ${logoutResult.ok}`);
        } catch {
          // Ignore logout errors - might not be logged in
        }

        // Log in as the new user
        const loginResult = await this.getRemoteCouchRootDB().logIn(username, password);
        log(`CREATEACCOUNT: logged in as new user: ${loginResult.ok}`);

        if (loginResult.ok) {
          // Migrate funnel account data if applicable
          if (isFunnelAccount) {
            logger.info(`Migrating data from funnel account ${funnelUsername} to ${username}`);
            const migrationResult = await this.migrateFunnelData(funnelUsername, username);
            if (!migrationResult.success) {
              logger.warn(`Migration failed: ${migrationResult.error}`);
              // Continue anyway - don't block account creation
            }
          }

          return {
            status: Status.ok,
            error: undefined,
          };
        } else {
          return {
            status: Status.error,
            error: 'Failed to log in after account creation',
          };
        }
      } else {
        logger.warn(`Signup not OK: ${JSON.stringify(signupRequest)}`);
        return {
          status: Status.error,
          error: 'Account creation failed',
        };
      }
    } catch (e: any) {
      if (e.reason === 'Document update conflict.') {
        return {
          status: Status.error,
          error: 'This username is taken!',
        };
      }
      logger.error(`Error on signup: ${JSON.stringify(e)}`);
      return {
        status: Status.error,
        error: e.message || 'Unknown error during account creation',
      };
    }
  }

  async authenticate(username: string, password: string): Promise<AuthenticationResult> {
    try {
      const loginResult = await this.getRemoteCouchRootDB().logIn(username, password);

      if (loginResult.ok) {
        log(`Successfully logged in as ${username}`);
        return {
          ok: true,
        };
      } else {
        log(`Login failed for ${username}`);
        return {
          ok: false,
          error: 'Invalid username or password',
        };
      }
    } catch (error: any) {
      logger.error(`Authentication error for ${username}:`, error);
      return {
        ok: false,
        error: error.message || 'Authentication failed',
      };
    }
  }

  async logout(): Promise<AuthenticationResult> {
    try {
      const result = await this.getRemoteCouchRootDB().logOut();
      return {
        ok: result.ok,
        error: result.ok ? undefined : 'Logout failed',
      };
    } catch (error: any) {
      logger.error('Logout error:', error);
      return {
        ok: false,
        error: error.message || 'Logout failed',
      };
    }
  }

  async getCurrentUsername(): Promise<string> {
    console.log('[funnel] CouchDBSyncStrategy.getCurrentUsername() called');
    try {
      const loggedInUsername = await getLoggedInUsername();
      console.log('[funnel] getLoggedInUsername() returned:', loggedInUsername);
      return loggedInUsername;
    } catch (e) {
      // Not logged in - return unique guest account
      console.log('[funnel] getLoggedInUsername() failed, calling accomodateGuest()');
      console.log('[funnel] Error was:', e);
      const guestInfo = accomodateGuest();
      console.log('[funnel] accomodateGuest() returned:', guestInfo);
      return guestInfo.username;
    }
  }

  /**
   * Migrate data from funnel account to real account
   */
  private async migrateFunnelData(
    oldUsername: string,
    newUsername: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info(`Starting data migration from ${oldUsername} to ${newUsername}`);

      const oldLocalDB = getLocalUserDB(oldUsername);
      const newLocalDB = getLocalUserDB(newUsername);

      // Get all docs from funnel account
      const allDocs = await oldLocalDB.allDocs({ include_docs: true });

      logger.info(`Found ${allDocs.rows.length} documents in funnel account`);

      // Filter out design docs and prepare for migration
      const docsToMigrate = allDocs.rows
        .filter(row => !row.id.startsWith('_design/'))
        .map(row => ({
          ...row.doc,
          _rev: undefined, // Remove rev to insert as new
        }));

      if (docsToMigrate.length > 0) {
        await newLocalDB.bulkDocs(docsToMigrate);
        logger.info(`Successfully migrated ${docsToMigrate.length} documents from ${oldUsername} to ${newUsername}`);
      } else {
        logger.info('No documents to migrate from funnel account');
      }

      return { success: true };
    } catch (error) {
      logger.error('Migration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get remote CouchDB root database for authentication operations
   */
  private getRemoteCouchRootDB(): PouchDB.Database {
    const remoteStr: string =
      ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + 'skuilder';

    try {
      return new pouch(remoteStr, {
        skip_setup: true,
      });
    } catch (error) {
      logger.error('Failed to initialize remote CouchDB connection:', error);
      throw new Error(`Failed to initialize CouchDB: ${JSON.stringify(error)}`);
    }
  }

  /**
   * Get remote user database for a specific user
   */
  private getUserDB(username: string): PouchDB.Database {
    const guestAccount: boolean = false;

    const hexName = hexEncode(username);
    const dbName = `userdb-${hexName}`;
    log(`Fetching user database: ${dbName} (${username})`);

    // Odd construction here the result of a bug in the
    // interaction between pouch, pouch-auth.
    // see: https://github.com/pouchdb-community/pouchdb-authentication/issues/239
    const ret = new pouch(
      ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + dbName,
      createPouchDBConfig()
    );

    if (guestAccount) {
      updateGuestAccountExpirationDate(ret);
    }

    return ret;
  }
}
