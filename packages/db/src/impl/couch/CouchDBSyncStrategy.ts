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
  /** In-flight one-shot hydration pull, so a timed-out pull can be abandoned. */
  private hydrationHandle?: PouchDB.Replication.Replication<object>;

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

  /**
   * One-shot remote → local pull. Resolves once the local mirror is caught up.
   *
   * Pull only: pushing here would upload whatever the local DB happens to hold
   * before we know what the remote already has, which is the conflict-leaf
   * problem hydration exists to avoid. Local changes go up when startSync()
   * takes over.
   *
   * Into an EMPTY local DB this skips deleted documents, because a mirror that
   * never held a document does not need to be told it was removed. That
   * matters more than it sounds: scheduled reviews (`card_review_*`) are
   * created and deleted once per review completed, so the changes feed is
   * dominated by tombstones and grows without bound, while the durable record
   * lives in card history. One real account measured 385 live documents behind
   * 8,370 deletions — an unfiltered pull moved 9,520 documents and took ~20s,
   * blowing the hydration timeout on a phone; filtered, the same pull moves
   * 404 and takes ~2s, reaching a byte-identical local state.
   *
   * The filter runs server-side, so `last_seq` still reports the source's true
   * sequence. Returning it lets startSync() begin the live pull from there
   * instead of re-walking the same history in the background — without that,
   * the cost is merely deferred, not removed.
   */
  async hydrate(
    localDB: PouchDB.Database,
    remoteDB: PouchDB.Database
  ): Promise<{ docsWritten: number; lastSeq?: string | number }> {
    // Skipping tombstones is only sound when there is nothing local for a
    // missed deletion to strand. A non-empty local DB here means a previous
    // hydration failed partway (no marker was written, so we are retrying) and
    // may hold documents the remote has since deleted — take the slow, honest
    // path and let the full changes feed reconcile them.
    const pristine = (await localDB.info()).doc_count === 0;

    // A one-shot Replication is itself a promise of the completed result, so
    // it can be awaited directly — the handle is retained only so a pull that
    // outlives its timeout can be cancelled.
    const replication = pouch.replicate(
      remoteDB,
      localDB,
      pristine ? { selector: { _deleted: { $exists: false } } } : {}
    );
    this.hydrationHandle = replication;

    try {
      const info = await replication;
      return {
        docsWritten: info.docs_written,
        // Only a pristine pull is a trustworthy starting point for the live
        // sync; otherwise leave startSync() to its own checkpoint.
        lastSeq: pristine ? info.last_seq : undefined,
      };
    } finally {
      this.hydrationHandle = undefined;
    }
  }

  startSync(
    localDB: PouchDB.Database,
    remoteDB: PouchDB.Database,
    since?: string | number
  ): void {
    // Compare by NAME, not object identity. In guest mode setupRemoteDB()
    // returns getLocalUserDB(username) — the same database as localDB — but
    // getLocalUserDB() constructs a fresh PouchDB handle on every call rather
    // than caching, so `localDB !== remoteDB` was always true and guests ran a
    // live sync of a database against itself. Names are unambiguous here:
    // local DBs are named `userdb-<username>` (or a filesystem path in Node),
    // remote ones are a full `protocol://host/userdb-<hex>` URL.
    if (localDB.name !== remoteDB.name) {
      this.syncHandle = pouch.sync(localDB, remoteDB, {
        live: true,
        retry: true,
        // `since` applies to the pull only, and only when hydrate() just
        // established that local matches remote at that sequence. Without it,
        // a filtered hydration leaves the pull with no usable checkpoint (the
        // filter changes the replication id), so it restarts from zero and
        // re-walks in the background exactly the tombstone history hydration
        // just skipped — same work, now competing with the study session.
        //
        // Deliberately NOT persisted across launches: on later boots hydration
        // is skipped and the pull's own checkpoint is the correct resume
        // point, so a stored sequence could only be stale. If the app dies
        // before that first checkpoint is written, the next launch simply
        // walks the full feed once.
        ...(since !== undefined ? { pull: { since } } : {}),
      });
    }
    // If they're the same DB (guest mode), no sync needed
  }

  stopSync?(): void {
    if (this.hydrationHandle) {
      try {
        this.hydrationHandle.cancel();
      } catch (e) {
        logger.warn(`Failed to cancel hydration pull (continuing anyway): ${e}`);
      }
      this.hydrationHandle = undefined;
    }

    if (this.syncHandle) {
      // Called from BaseUser.init(), which is on the app boot path — a throw
      // here would leave BaseUser._initialized false forever, and
      // BaseUser.instance() polls that flag. Drop the handle regardless.
      try {
        this.syncHandle.cancel();
      } catch (e) {
        logger.warn(`Failed to cancel user sync (continuing anyway): ${e}`);
      }
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
    logger.log('[funnel] CouchDBSyncStrategy.getCurrentUsername() called');
    try {
      const loggedInUsername = await getLoggedInUsername();
      logger.log('[funnel] getLoggedInUsername() returned:', loggedInUsername);
      return loggedInUsername;
    } catch (e) {
      // Not logged in - return unique guest account
      logger.log('[funnel] getLoggedInUsername() failed, calling accomodateGuest()');
      logger.log('[funnel] Error was:', e);
      const guestInfo = accomodateGuest();
      logger.log('[funnel] accomodateGuest() returned:', guestInfo);
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

      // Destroy the consumed guest DB so it can never be re-migrated into a
      // future account. Without this, an orphaned userdb-sk-guest-<uuid> lingers
      // in IndexedDB indefinitely; if its stale identity is later re-adopted
      // (e.g. on logout via a surviving sk-guest-uuid), its progress bleeds into
      // the next new account. Best-effort: migration has already succeeded, so a
      // teardown failure must not fail account creation.
      try {
        await oldLocalDB.destroy();
        logger.info(`Destroyed consumed guest DB for ${oldUsername}`);
      } catch (destroyErr) {
        logger.warn(
          `Failed to destroy consumed guest DB for ${oldUsername} (non-fatal): ${
            destroyErr instanceof Error ? destroyErr.message : String(destroyErr)
          }`
        );
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
