// packages/db/src/impl/common/SyncStrategy.ts

import { AccountCreationResult, AuthenticationResult } from './types';

/**
 * Strategy interface for handling user data synchronization
 * Different implementations handle remote sync vs local-only storage
 */
export interface SyncStrategy {
  /**
   * Set up the remote database for a user
   * @param username The username to set up remote DB for
   * @returns PouchDB database instance (may be same as local for no-op)
   */
  setupRemoteDB(username: string): PouchDB.Database;

  /**
   * Start synchronization between local and remote databases
   * @param localDB The local PouchDB instance
   * @param remoteDB The remote PouchDB instance
   */
  startSync(localDB: PouchDB.Database, remoteDB: PouchDB.Database): void;

  /**
   * Stop synchronization (optional - for cleanup)
   */
  stopSync?(): void;

  /**
   * Whether this strategy supports account creation
   */
  canCreateAccount(): boolean;

  /**
   * Whether this strategy supports authentication
   */
  canAuthenticate(): boolean;

  /**
   * Create a new user account (if supported)
   * @param username The username for the new account
   * @param password The password for the new account
   */
  createAccount?(username: string, password: string): Promise<AccountCreationResult>;

  /**
   * Authenticate a user (if supported)
   * @param username The username to authenticate
   * @param password The password to authenticate with
   */
  authenticate?(username: string, password: string): Promise<AuthenticationResult>;

  /**
   * Log out the current user (if supported)
   */
  logout?(): Promise<AuthenticationResult>;

  /**
   * Get the current logged-in username
   * Returns the username if logged in, or a default guest username
   */
  getCurrentUsername(): Promise<string>;
}

/**
 * Base class for sync strategies with common functionality
 */
export abstract class BaseSyncStrategy implements SyncStrategy {
  abstract setupRemoteDB(username: string): PouchDB.Database;
  abstract startSync(localDB: PouchDB.Database, remoteDB: PouchDB.Database): void;
  abstract canCreateAccount(): boolean;
  abstract canAuthenticate(): boolean;
  abstract getCurrentUsername(): Promise<string>;

  stopSync?(): void {
    // Default no-op implementation
  }

  async createAccount(_username: string, _password: string): Promise<AccountCreationResult> {
    throw new Error('Account creation not supported by this sync strategy');
  }

  async authenticate(_username: string, _password: string): Promise<AuthenticationResult> {
    throw new Error('Authentication not supported by this sync strategy');
  }

  async logout(): Promise<AuthenticationResult> {
    throw new Error('Logout not supported by this sync strategy');
  }
}
