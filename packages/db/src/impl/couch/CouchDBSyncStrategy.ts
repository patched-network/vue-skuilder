// packages/db/src/impl/couch/CouchDBSyncStrategy.ts

import { ENV } from '@db/factory';
import { GuestUsername } from '../../core/types/types-legacy';
import { logger } from '../../util/logger';
import { Status } from '@vue-skuilder/common';
import type { SyncStrategy } from '../common/SyncStrategy';
import type { AccountCreationResult, AuthenticationResult } from '../common/types';
import { getLocalUserDB, hexEncode, updateGuestAccountExpirationDate } from '../common';
import pouch from './pouchdb-setup';
import { pouchDBincludeCredentialsConfig } from './index';
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
          // TODO: Handle guest data migration here if needed
          // Set up databases for the new user:
          // const newLocal = getLocalUserDB(username);
          // const newRemote = this.getUserDB(username);

          // For now, just return success
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
    try {
      return await getLoggedInUsername();
    } catch {
      return GuestUsername;
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
      pouchDBincludeCredentialsConfig
    );

    if (guestAccount) {
      updateGuestAccountExpirationDate(ret);
    }

    return ret;
  }
}
