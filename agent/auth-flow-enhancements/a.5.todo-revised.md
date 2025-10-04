# Todo (Revised): Enhanced Authentication (Phase 1 - DB Layer)

**Note**: This document revises and supersedes `a.4.todo.md`. It correctly separates the type definitions for the system-level `_users` database from the core, implementation-agnostic types.

## Phase 1: Database Layer Modifications

### 1.1: Define System User Document Types

**Objective**: Establish the new TypeScript types for the CouchDB `_users` document schema in a location specific to the CouchDB implementation.

- [x] **1.1.1**: Create a new file at `packages/db/src/impl/couch/users.types.ts` to define the application-specific schema for user documents stored in the CouchDB `_users` database.
  - **Rationale**: This isolates CouchDB-specific schemas, preventing pollution of the core interfaces and ensuring that static deployment models (which do not use an `_users` database) are unaffected.

- [x] **1.1.2**: Add the following type definitions to the new file `packages/db/src/impl/couch/users.types.ts`:

  ```typescript
  // New enum for user account status
  export type UserAccountStatus = 'pending_verification' | 'verified' | 'suspended';

  // Describes a user's entitlement for a single course/site
  export interface Entitlement {
    status: 'trial' | 'paid';
    registrationDate: string; // ISO 8601 format
    expires?: string; // ISO 8601 format, optional
  }

  // Maps a courseId to a user's entitlement for that course
  export type UserEntitlements = Record<string, Entitlement>;

  // Represents the full user document in CouchDB's `_users` database, extending a base PouchDB user type
  export interface CouchDbUserDoc extends PouchDB.Authentication.User {
    // New application-specific fields
    email: string;
    status: UserAccountStatus;
    verificationToken?: string | null;
    verificationTokenExpiresAt?: string | null; // ISO 8601 format
    entitlements: UserEntitlements;
  }
  ```

### 1.2: Update Data Layer Interface

**Objective**: Extend the `UserDBAuthenticator` interface to include methods for the new authentication flows. The interface itself remains implementation-agnostic.

- [x] **1.2.1**: Modify the `UserDBAuthenticator` interface in `packages/db/src/core/interfaces/userDB.ts`.
- [x] **1.2.2**: Add the following new method signatures. Note that they will use generic types or import from the new `users.types.ts` file where necessary for the implementation, but the interface itself remains clean.

  ```typescript
  // No new imports needed here if we use generic types, but the implementation will need them.
  // For clarity in the interface, we can reference the concept.
  type UserEntitlementsObject = Record<string, any>; // Generic representation

  // ... inside UserDBAuthenticator interface

  /**
   * Creates a new user account in a pending state.
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
  updateUserEntitlements(username: string, entitlements: UserEntitlementsObject): Promise<{ ok: boolean; error?: string }>;
  ```

### 1.3: Update Data Layer Implementation

**Objective**: Implement the logic for the new interface methods in the CouchDB-specific `BaseUserDB`.

- [ ] **1.3.1**: Implement the new `createVerifiedAccount` method in `packages/db/src/impl/common/BaseUserDB.ts`. This method will create the user with their password hash, but set their application-level `status` to `pending_verification`.
- [ ] **1.3.2**: Implement the new token generation methods (`generateVerificationToken`, `generatePasswordResetToken`) in `BaseUserDB`. This will involve creating a secure random token and updating the user document in the `_users` database with the token and an expiry date.
- [ ] **1.3.3**: Implement the token validation methods (`completeVerification`, `resetPassword`) in `BaseUserDB`. The `completeVerification` method will now only change the user's `status` to `verified`.
- [ ] **1.3.4**: Implement the `updateUserEntitlements` method in `BaseUserDB`.
