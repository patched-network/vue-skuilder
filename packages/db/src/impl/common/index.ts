// packages/db/src/impl/common/index.ts

export type { SyncStrategy } from './SyncStrategy';
export { BaseSyncStrategy } from './SyncStrategy';
export type {
  AccountCreationResult,
  AuthenticationResult,
  UserSession,
  SyncConfig,
  SyncStatus,
} from './types';
export { BaseUser } from './BaseUserDB';
export {
  REVIEW_TIME_FORMAT,
  hexEncode,
  filterAllDocsByPrefix,
  getStartAndEndKeys,
  updateGuestAccountExpirationDate,
  getLocalUserDB,
  scheduleCardReviewLocal,
  removeScheduledCardReviewLocal,
} from './userDBHelpers';
