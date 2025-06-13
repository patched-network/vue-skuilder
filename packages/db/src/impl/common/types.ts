// packages/db/src/impl/common/types.ts

/**
 * Common types used by UserDB implementations across different sync strategies
 */

import { Status } from '@vue-skuilder/common';

/**
 * Result type for account creation operations
 */
export interface AccountCreationResult {
  status: Status;
  error?: string;
}

/**
 * Result type for authentication operations
 */
export interface AuthenticationResult {
  ok: boolean;
  error?: string;
}

/**
 * User session information
 */
export interface UserSession {
  username: string;
  isLoggedIn: boolean;
  isGuest: boolean;
}

/**
 * Configuration for sync behavior
 */
export interface SyncConfig {
  live?: boolean;
  retry?: boolean;
  continuous?: boolean;
}

/**
 * Sync status information
 */
export interface SyncStatus {
  active: boolean;
  lastSync?: Date;
  error?: string;
}
