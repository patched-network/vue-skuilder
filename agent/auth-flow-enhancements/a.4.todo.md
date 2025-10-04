# Todo: Enhanced Authentication (Phase 1 - DB Layer)

This document itemizes the tasks required to complete Phase 1 of the plan outlined in `a.3.plan.md`.

## Phase 1: Database Layer Modifications

### 1.1: Define Updated User Schema Types

**Objective**: Establish the new TypeScript types for the user schema to ensure type safety across the DB and Express packages.

- [ ] **1.1.1**: Modify `packages/db/src/core/types/user.ts` to add the following new types.
  - **Note**: This file is the most logical location as it already contains user-related type definitions like `UserConfig` and `CourseRegistration`. Exporting these types from the `@vue-skuilder/db` package will make them available to the `@vue-skuilder/express` package.

  ```typescript
  // New enum for user status
  export type UserAccountStatus = 'pending_verification' | 'verified' | 'suspended';

  // Describes a user's entitlement for a single course/site
  export interface Entitlement {
    status: 'trial' | 'paid';
    registrationDate: string; // ISO 8601 format
    expires?: string; // ISO 8601 format, optional
  }

  // Maps a courseId to a user's entitlement for that course
  export type UserEntitlements = Record<string, Entitlement>;

  // Represents the full user document in CouchDB's `_users` database
  export interface CouchDbUserDoc {
    _id: `org.couchdb.user:${string}`;
    _rev: string;
    type: 'user';
    name: string;
    roles: string[];
    password_scheme?: string;
    iterations?: number;
    derived_key?: string;
    salt?: string;

    // New application-specific fields
    email: string;
    status: UserAccountStatus;
    verificationToken?: string | null;
    verificationTokenExpiresAt?: string | null; // ISO 8601 format
    entitlements: UserEntitlements;
  }
  ```

### 1.2: Update Data Layer Interface

**Objective**: Extend the `UserDBAuthenticator` interface to include methods for the new authentication flows.

- [ ] **1.2.1**: Modify the `UserDBAuthenticator` interface in `packages/db/src/core/interfaces/userDB.ts`.
- [ ] **1.2.2**: Add the following new method signatures:

  ```typescript
  import { UserEntitlements } from '../types/user'; // Assuming types are in user.ts

  // ... inside UserDBAuthenticator interface

  /**
   * Creates a new user account in a pending state.
   * Password is not set at this stage.
   */
  createAccount(email: string, username: string): Promise<{ status: Status; error?: string }>;

  /**
   * Generates and stores a verification token for a user.
   */
  generateVerificationToken(username: string): Promise<string>;

  /**
   * Completes the verification process using a token.
   */
  completeVerification(token: string): Promise<{ ok: boolean; username?: string; error?: string }>;

  /**
   * Sets the password for a user (e.g., after verification).
   */
  setPassword(username: string, password: string): Promise<{ ok: boolean; error?: string }>;

  /**
   * Generates and stores a password reset token for a user identified by email.
   */
  generatePasswordResetToken(email: string): Promise<string>;

  /**
   * Resets a user's password using a valid token.
   */
  resetPassword(token: string, newPassword: string): Promise<{ ok: boolean; error?: string }>;

  /**
   * A privileged method to update a user's entitlements.
   */
  updateUserEntitlements(username: string, entitlements: UserEntitlements): Promise<{ ok: boolean; error?: string }>;
  ```

### 1.3: Update Data Layer Implementation

**Objective**: Implement the logic for the new interface methods in `BaseUserDB`.

- [ ] **1.3.1**: Modify the `createAccount` method in `packages/db/src/impl/common/BaseUserDB.ts` to align with the new interface. It should create a user document with `status: 'pending_verification'`.
- [ ] **1.3.2**: Implement the new token generation methods (`generateVerificationToken`, `generatePasswordResetToken`) in `BaseUserDB`. This will involve creating a secure random token and updating the corresponding user document in the `_users` database with the token and an expiry date.
- [ ] **1.3.3**: Implement the token validation methods (`completeVerification`, `resetPassword`) in `BaseUserDB`. This logic will find a user by their token, check for expiry, and then perform the appropriate action (update status or update password hash).
- [ ] **1.3.4**: Implement the `setPassword` method in `BaseUserDB`.
- [ ] **1.3.5**: Implement the `updateUserEntitlements` method in `BaseUserDB`.
