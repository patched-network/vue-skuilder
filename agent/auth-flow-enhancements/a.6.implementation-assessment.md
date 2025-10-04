# Implementation Assessment: Auth Flow Enhancements

## Current Status

### Completed Work (Phase 1.1 & 1.2)
- ✅ `packages/db/src/impl/couch/users.types.ts` created with CouchDB-specific user types
- ✅ `packages/db/src/core/interfaces/userDB.ts` extended with new auth methods

### Work In Progress
- Phase 1.3: Implementation in `BaseUserDB.ts` and `CouchDBSyncStrategy.ts`

## Clarified Authentication Flows

### Account Creation Flow
1. `createVerifiedAccount(email, username, password)`:
   - Creates user doc in `_users` database with password hash
   - Sets `status: 'pending_verification'`
   - Generates verification token + expiry timestamp
   - Stores token in user doc
   - Returns success/error

2. Email sent with magic link containing token

3. `completeVerification(token)`:
   - Validates token (exists, not expired)
   - Updates user doc `status: 'verified'`
   - Clears verification token
   - User can now login with username/password

### Password Reset Flow
1. `generatePasswordResetToken(email)`:
   - Looks up user by email
   - Generates reset token + expiry
   - Stores in user doc (separate field from verification token)
   - Returns token for email sending

2. Email sent with magic link

3. `resetPassword(token, newPassword)`:
   - Validates token (exists, not expired, matches user)
   - Updates user password hash
   - Clears reset token
   - Returns success/error

## Architecture Understanding

### Two-Layer Implementation Pattern

**Layer 1: BaseUserDB (`packages/db/src/impl/common/BaseUserDB.ts`)**
- High-level interface implementation
- Delegates auth operations to `SyncStrategy`
- Handles local/remote DB coordination
- Current methods: `createAccount()`, `login()`, `logout()`

**Layer 2: SyncStrategy Implementations**
- `CouchDBSyncStrategy` (`packages/db/src/impl/couch/CouchDBSyncStrategy.ts`):
  - Uses PouchDB authentication plugin
  - Methods: `createAccount()`, `authenticate()`, `logout()`
  - Direct access to `_users` database via `getRemoteCouchRootDB()`
- `NoOpSyncStrategy` (local-only, no remote auth)

### Key Insight: Direct _users Database Access

The new auth methods (token generation, verification, entitlements) require **direct manipulation** of `_users` database documents. This is different from the existing `createAccount()` flow which uses the PouchDB auth plugin's `signUp()` method.

**Required approach:**
- Use `getRemoteCouchRootDB()` to get admin-level access to `_users` DB
- Read/write user documents directly using PouchDB's `.get()` and `.put()` methods
- User doc ID format: `org.couchdb.user:{username}`

## Implementation Strategy

### Phase 1.3.1: Add Types to Entitlement
File: `packages/db/src/impl/couch/users.types.ts`

Add missing `purchaseDate` field to `Entitlement` interface:
```typescript
export interface Entitlement {
  status: 'trial' | 'paid';
  registrationDate: string; // ISO 8601
  purchaseDate: string; // ISO 8601 - ADD THIS
  expires?: string; // ISO 8601
}
```

### Phase 1.3.2: Implement in BaseUserDB
File: `packages/db/src/impl/common/BaseUserDB.ts`

Add four new methods that delegate to `syncStrategy`:

```typescript
public async createVerifiedAccount(
  email: string,
  username: string,
  password: string
): Promise<{ status: Status; error?: string }> {
  if (!this.syncStrategy.canCreateAccount()) {
    throw new Error('Account creation not supported');
  }

  return this.syncStrategy.createVerifiedAccount!(email, username, password);
}

public async generateVerificationToken(username_or_email: string): Promise<string> {
  if (!this.syncStrategy.canAuthenticate()) {
    throw new Error('Verification not supported');
  }

  return this.syncStrategy.generateVerificationToken!(username_or_email);
}

public async completeVerification(
  token: string
): Promise<{ ok: boolean; username?: string; error?: string }> {
  if (!this.syncStrategy.canAuthenticate()) {
    throw new Error('Verification not supported');
  }

  return this.syncStrategy.completeVerification!(token);
}

public async generatePasswordResetToken(email: string): Promise<string> {
  if (!this.syncStrategy.canAuthenticate()) {
    throw new Error('Password reset not supported');
  }

  return this.syncStrategy.generatePasswordResetToken!(email);
}

public async resetPassword(
  token: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (!this.syncStrategy.canAuthenticate()) {
    throw new Error('Password reset not supported');
  }

  return this.syncStrategy.resetPassword!(token, newPassword);
}

public async updateUserEntitlements(
  username: string,
  entitlements: Record<string, any>
): Promise<{ ok: boolean; error?: string }> {
  if (!this.syncStrategy.canAuthenticate()) {
    throw new Error('Entitlements not supported');
  }

  return this.syncStrategy.updateUserEntitlements!(username, entitlements);
}
```

### Phase 1.3.3: Update SyncStrategy Interface
File: `packages/db/src/impl/common/SyncStrategy.ts`

Add new optional methods to `SyncStrategy` interface:
```typescript
createVerifiedAccount?(email: string, username: string, password: string): Promise<AccountCreationResult>;
generateVerificationToken?(username_or_email: string): Promise<string>;
completeVerification?(token: string): Promise<{ ok: boolean; username?: string; error?: string }>;
generatePasswordResetToken?(email: string): Promise<string>;
resetPassword?(token: string, newPassword: string): Promise<{ ok: boolean; error?: string }>;
updateUserEntitlements?(username: string, entitlements: Record<string, any>): Promise<{ ok: boolean; error?: string }>;
```

### Phase 1.3.4: Implement in CouchDBSyncStrategy
File: `packages/db/src/impl/couch/CouchDBSyncStrategy.ts`

Implement all six new methods using direct `_users` database access.

**Key implementation details:**
- Use `crypto.randomBytes(32).toString('hex')` for token generation
- Tokens expire after 24 hours (configurable)
- User doc ID: `org.couchdb.user:{username}`
- Import and use `CouchDbUserDoc` type from `users.types.ts`

## Dependencies to Review

### Token Generation
Need secure random token generation:
- Node.js: `crypto.randomBytes()`
- Browser: `crypto.getRandomValues()`

### Time Handling
Already using `moment` in BaseUserDB - can use for token expiry calculations.

## Next Steps

1. ✅ Review clarified flow (completed)
2. 🔄 Write this assessment (in progress)
3. ⏳ Implement `purchaseDate` in Entitlement type
4. ⏳ Extend SyncStrategy interface
5. ⏳ Implement methods in BaseUserDB (delegation layer)
6. ⏳ Implement methods in CouchDBSyncStrategy (actual logic)
7. ⏳ Test locally with CouchDB

## Open Questions

1. **Token storage field naming**: Should password reset use a separate `passwordResetToken` field or reuse `verificationToken`?
   - Recommendation: Separate fields for clarity and security

2. **Token expiry duration**: 24 hours reasonable for both verification and password reset?
   - Recommendation: 24h for verification, 1h for password reset

3. **Email lookup**: `generateVerificationToken` and `generatePasswordResetToken` need to find users by email. Need to query `_users` DB by email field.
   - Implementation: Use `db.allDocs()` with `include_docs: true` and filter, or create a view
