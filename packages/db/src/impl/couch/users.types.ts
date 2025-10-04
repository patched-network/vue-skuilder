// New enum for user account status
export type UserAccountStatus = 'pending_verification' | 'verified' | 'suspended';

// Describes a user's entitlement for a single course/site
export interface Entitlement {
  status: 'trial' | 'paid';
  registrationDate: string; // ISO 8601 format
  purchaseDate: string; // ISO 8601 format
  expires?: string; // ISO 8601 format, optional
}

// Maps a courseId to a user's entitlement for that course
export type UserEntitlements = Record<string, Entitlement>;

// Represents the full user document in CouchDB's `_users` database, extending a base PouchDB user type
export interface CouchDbUserDoc extends PouchDB.Authentication.User {
  // Core user fields
  name: string; // Username
  // New application-specific fields
  email: string;
  status: UserAccountStatus;
  verificationToken?: string | null;
  verificationTokenExpiresAt?: string | null; // ISO 8601 format
  passwordResetToken?: string | null;
  passwordResetTokenExpiresAt?: string | null; // ISO 8601 format
  entitlements: UserEntitlements;
}
