// packages/db/src/impl/static/NoOpSyncStrategy.ts

import { GuestUsername } from '../../core/types/types-legacy';
import type { SyncStrategy } from '../common/SyncStrategy';
import type { AccountCreationResult, AuthenticationResult } from '../common/types';
import { getLocalUserDB, accomodateGuest } from '../common';

/**
 * Sync strategy for static deployments that provides no-op implementations
 * for remote operations. Uses only local storage with no remote synchronization.
 */
export class NoOpSyncStrategy implements SyncStrategy {
  private currentUsername: string = accomodateGuest().username;

  setupRemoteDB(username: string): PouchDB.Database {
    // Return the same database instance as local - sync with self is a no-op
    return getLocalUserDB(username);
  }

  getWriteDB(username: string): PouchDB.Database {
    // In static mode, always write to local database
    return getLocalUserDB(username);
  }

  startSync(_localDB: PouchDB.Database, _remoteDB: PouchDB.Database): void {
    // No-op - in static mode, local and remote are the same database instance
    // PouchDB sync with itself is harmless and efficient
  }

  stopSync?(): void {
    // No-op - no sync to stop in static mode
  }

  canCreateAccount(): boolean {
    return false; // Account creation not supported in static mode
  }

  canAuthenticate(): boolean {
    return false; // Remote authentication not supported in static mode
  }

  async createAccount(_username: string, _password: string): Promise<AccountCreationResult> {
    throw new Error(
      'Account creation not supported in static mode. Use local account switching instead.'
    );
  }

  async authenticate(_username: string, _password: string): Promise<AuthenticationResult> {
    throw new Error(
      'Remote authentication not supported in static mode. Use local account switching instead.'
    );
  }

  async logout(): Promise<AuthenticationResult> {
    // In static mode, "logout" means switch back to guest user
    this.currentUsername = accomodateGuest().username;
    return {
      ok: true,
    };
  }

  async getCurrentUsername(): Promise<string> {
    // In static mode, always return guest username
    // TODO: This will be enhanced with local account switching to support multiple local users
    return this.currentUsername;
  }

  /**
   * Set the current username (for local account switching)
   * This method is specific to NoOpSyncStrategy and not part of the base interface
   */
  setCurrentUsername(username: string): void {
    this.currentUsername = username;
  }
}
