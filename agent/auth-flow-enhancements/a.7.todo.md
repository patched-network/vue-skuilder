# Todo: Enhanced Authentication Implementation (Revised Architecture)

This document supersedes previous todo documents and tracks the implementation of enhanced authentication flows.

## Architecture Overview (REVISED)

### Key Decision: Keep @db Package Pure

After reviewing the existing architecture, we determined that:
- `@db` package has **no Express dependencies** and should remain pure data layer
- `common-ui` components already call user methods directly (e.g., `UserRegistration.vue:138`)
- New auth flows are **UI-driven operations**, not core DB layer operations

### Request Flow Pattern

```
UserRegistration.vue / useAuthUI composable (common-ui)
  ↓ fetch() to Express API
Express API Endpoint (/auth/register, /auth/verify, /auth/reset-password)
  ↓ admin credentials
CouchDB _users Database
  ↓ response
Express → Browser (common-ui)
```

**Key Points:**
- Auth flows are orchestrated in `common-ui` via composables
- `common-ui` already has access to `EXPRESS_SERVER_URL` via `platform-ui` ENV
- Express handles all token generation, storage, and validation server-side
- `@db` package remains unchanged (no new methods needed)
- Only new shared types needed in `@db/impl/couch/users.types.ts`

### Why This Is Better

1. **Separation of Concerns**: `@db` = pure data access, `common-ui` = user-facing operations
2. **Environment Access**: `common-ui` already has `EXPRESS_SERVER_URL` configured
3. **Existing Pattern**: `UserRegistration.vue` already calls `user.createAccount()` directly
4. **No Breaking Changes**: Existing `UserDBInterface` remains stable

## Phase 1: Shared Types ✅ COMPLETED

### 1.1: Update CouchDB User Document Types

**File**: `packages/db/src/impl/couch/users.types.ts`

- [x] **1.1.1**: Add `purchaseDate` field to `Entitlement` interface
  - ✅ Field already existed in the interface

- [x] **1.1.2**: Add password reset token fields to `CouchDbUserDoc`
  - ✅ Added `passwordResetToken?: string | null;`
  - ✅ Added `passwordResetTokenExpiresAt?: string | null;`

- [x] **1.1.3**: Export these types from `@db` package for use in Express
  - ✅ Added type exports to `packages/db/src/index.ts`:
    ```typescript
    export type {
      UserAccountStatus,
      Entitlement,
      UserEntitlements,
      CouchDbUserDoc,
    } from './impl/couch/users.types';
    ```
  - ✅ Build successful - types available for import in Express

## Phase 2: Common-UI Auth Implementation (Option A: Frontend-Driven) ✅ COMPLETED

### Architecture Decision: Keep Existing Flow + Add Email Tracking

**Key Points**:
- ✅ Keep `user.createAccount(username, password)` via PouchDB (unchanged)
- ✅ Store email in `userdb-{username}/CONFIG` (user-accessible)
- ✅ Trigger verification post-account-creation via Express API
- ✅ Use relative paths `/auth/*` - no ENV coupling needed

### 2.0: Add Email to UserConfig Type

**File**: `packages/db/src/core/types/user.ts`

- [x] **2.0.1**: Add optional `email` field to `UserConfig` interface
  ```typescript
  export interface UserConfig {
    darkMode: boolean;
    likesConfetti: boolean;
    sessionTimeLimit: number;
    email?: string; // ADD THIS - optional for backward compat
  }
  ```

### 2.1: Create Auth API Service

**File**: `packages/common-ui/src/services/authAPI.ts` (NEW)

- [x] **2.1.1**: Create `authAPI.ts` with functions using **relative paths** (same-origin):
  ```typescript
  export async function sendVerificationEmail(username: string): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch('/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username })
    });
    return response.json();
  }

  export async function verifyEmail(token: string): Promise<{ ok: boolean; username?: string; error?: string }> {
    const response = await fetch('/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token })
    });
    return response.json();
  }

  export async function requestPasswordReset(email: string): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch('/auth/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email })
    });
    return response.json();
  }

  export async function resetPassword(token: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, newPassword })
    });
    return response.json();
  }
  ```

### 2.2: Update UserRegistration Component

**File**: `packages/common-ui/src/components/auth/UserRegistration.vue`

- [x] **2.2.1**: Add email field to data and template
  - ✅ Added `email: ''` to component data
  - ✅ Added `<v-text-field>` for email with validation

- [x] **2.2.2**: Update `createUser()` method
  - ✅ Calls existing `user.createAccount(username, password)`
  - ✅ Saves email to user config on success
  - ✅ Calls `sendVerificationEmail(username)`
  - ✅ Shows "Check your email" message

### 2.3: Create Verification Component ✅

**File**: `packages/common-ui/src/components/auth/VerifyEmail.vue` (NEW)

- [x] **2.3.1**: Create component to handle verification flow
  - ✅ Reads `token` from prop or URL query params
  - ✅ Calls `verifyEmail(token)` on mount
  - ✅ Shows success/error states with icons
  - ✅ Emits events for navigation (router-agnostic)

### 2.4: Create Password Reset Components ✅

**File**: `packages/common-ui/src/components/auth/RequestPasswordReset.vue` (NEW)

- [x] **2.4.1**: Create form with email input
- [x] **2.4.2**: Call `requestPasswordReset(email)` on submit
- [x] **2.4.3**: Show "Check your email" success state
- [x] Emits `cancel` and `success` events for navigation

**File**: `packages/common-ui/src/components/auth/ResetPassword.vue` (NEW)

- [x] **2.4.4**: Create form with new password input
- [x] **2.4.5**: Read `token` from prop or URL query params
- [x] **2.4.6**: Call `resetPassword(token, newPassword)` on submit
- [x] **2.4.7**: Shows success state, emits `complete` event for navigation

### 2.5: Export Auth Components & Services ✅

**File**: `packages/common-ui/src/components/auth/index.ts`

- [x] **2.5.1**: Export all new auth components
- [x] **2.5.2**: Export auth API functions (router-agnostic)
  - ✅ `sendVerificationEmail()`
  - ✅ `verifyEmail()`
  - ✅ `requestPasswordReset()`
  - ✅ `resetPassword()`

**External Usage Example:**
```typescript
// In scaffolded course or external app
import {
  VerifyEmail,
  ResetPassword,
  verifyEmail  // Direct API call if needed
} from '@vue-skuilder/common-ui';
```

## Phase 3: Express Backend Implementation ✅ COMPLETED

### 3.1: Auth Routes Module

**File**: `packages/express/src/routes/auth.ts` (NEW)

- [x] **3.1.1**: Create POST `/auth/register` endpoint
  - Validate email, username, password
  - Create user in CouchDB `_users` DB with admin credentials
  - Generate verification token (24h expiry)
  - Store token in user doc
  - Return success (token sent via email service, not in response)

- [x] **3.1.2**: Create POST `/auth/verify` endpoint
  - Accept token in body
  - Look up user by verification token
  - Validate token not expired
  - Update user status to 'verified'
  - Clear verification token
  - Return success with username

- [x] **3.1.3**: Create POST `/auth/request-password-reset` endpoint
  - Accept email in body
  - Look up user by email
  - Generate password reset token (1h expiry)
  - Store token in user doc
  - Return success (token sent via email service)

- [x] **3.1.4**: Create POST `/auth/reset-password` endpoint
  - Accept token and newPassword in body
  - Look up user by reset token
  - Validate token not expired
  - Update user password (using CouchDB admin API)
  - Clear reset token
  - Return success

### 3.2: User Lookup Utilities

**File**: `packages/express/src/couchdb/userLookup.ts` (NEW)

- [x] **3.2.1**: Implement `findUserByEmail(email: string)` helper
  - Query `_users` DB with admin credentials
  - Use design doc view for email lookup (see 3.3 below)

- [x] **3.2.2**: Implement `findUserByToken(token: string, tokenType: 'verification' | 'reset')` helper
  - Query `_users` DB with admin credentials
  - Use design doc view for token lookup

### 3.3: Design Documents for _users DB

**File**: `packages/express/src/couchdb/userDesignDocs.ts` (NEW)

- [x] **3.3.1**: Create design doc with email index view
  ```javascript
  {
    _id: '_design/users',
    views: {
      by_email: {
        map: function(doc) {
          if (doc.type === 'user' && doc.email) {
            emit(doc.email, doc._id);
          }
        }
      },
      by_verification_token: {
        map: function(doc) {
          if (doc.type === 'user' && doc.verificationToken) {
            emit(doc.verificationToken, doc._id);
          }
        }
      },
      by_reset_token: {
        map: function(doc) {
          if (doc.type === 'user' && doc.passwordResetToken) {
            emit(doc.passwordResetToken, doc._id);
          }
        }
      }
    }
  }
  ```

- [x] **3.3.2**: Apply design doc on Express startup (look for prior art in existing Express code)

### 3.4: Token Generation Utilities

**File**: `packages/express/src/utils/tokens.ts` (NEW)

- [x] **3.4.1**: Create `generateSecureToken()` function
  ```typescript
  import crypto from 'crypto';

  export function generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  ```

- [x] **3.4.2**: Create `getTokenExpiry(hours: number)` function
  ```typescript
  export function getTokenExpiry(hours: number): string {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  }
  ```

### 3.5: Email Service (Stub for Now)

**File**: `packages/express/src/services/email.ts` (NEW)

- [x] **3.5.1**: Create email service interface
  ```typescript
  export async function sendVerificationEmail(to: string, token: string): Promise<void> {
    // For now, just log to console
    console.log(`
      ====================================
      VERIFICATION EMAIL
      To: ${to}
      Link: ${process.env.APP_URL}/verify?token=${token}
      ====================================
    `);
  }

  export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
    // Similar pattern
  }
  ```

- [x] **3.5.2**: Add TODO comment for future email provider integration (SendGrid, AWS SES, etc.)

### 3.6: Mount Auth Routes

**File**: `packages/express/src/app-factory.ts` (or wherever routes are registered)

- [x] **3.6.1**: Import and mount auth routes
  ```typescript
  import authRoutes from './routes/auth';
  app.use('/auth', authRoutes);
  ```

## Phase 4: Platform-UI Integration ✅ COMPLETED

**Multi-Frontend Support Note**: All auth endpoints and functions now support optional `origin` parameter to construct correct verification/reset links for multiple frontends sharing the same backend (e.g., platform-ui, scaffolded courses). The frontend's `window.location.origin` is automatically passed to backend.

### 4.1: Add Routes ✅

**File**: `packages/platform-ui/src/router.ts`

- [x] **4.1.1**: Add route for email verification page
  - ✅ Created view wrapper at `packages/platform-ui/src/views/VerifyEmail.vue`
  - ✅ Added route: `{ path: '/verify', name: 'verify', component: VerifyEmailView }`
  - ✅ View handles navigation via event listeners and slots

- [x] **4.1.2**: Add route for password reset request page
  - ✅ Created view wrapper at `packages/platform-ui/src/views/RequestPasswordReset.vue`
  - ✅ Added route: `{ path: '/request-reset', name: 'request-reset', component: RequestPasswordResetView }`

- [x] **4.1.3**: Add route for password reset confirmation page
  - ✅ Created view wrapper at `packages/platform-ui/src/views/ResetPassword.vue`
  - ✅ Added route: `{ path: '/reset-password', name: 'reset-password', component: ResetPasswordView }`

### 4.2: Update Registration Flow ✅

**File**: `packages/common-ui/src/components/auth/UserLogin.vue`

- [x] **4.2.1**: Update to use new `UserRegistration` component with email field
  - ✅ UserRegistration already updated in Phase 2 with email field
  - ✅ No changes needed to platform-ui - using component from common-ui

- [x] **4.2.2**: Add "Forgot password?" link to login view
  - ✅ Added "Forgot password?" link to UserLogin component
  - ✅ Link routes to `/request-reset`
  - ✅ Implemented as slot for flexibility (can be overridden by parent apps)
  - ✅ Only shows when on logi n route (same pattern as "Create New Account")

## Testing Plan

### 5.1: Manual Testing Checklist

- [ ] **5.1.1**: Test account creation flow
  - Fill out registration form with email
  - Verify console shows email with token
  - Copy token from console logs
  - Visit `/verify?token=...`
  - Verify account status changed to 'verified'
  - Log in with username/password

- [ ] **5.1.2**: Test password reset flow
  - Request password reset
  - Copy token from console logs
  - Visit reset link with token
  - Set new password
  - Log in with new password

- [ ] **5.1.3**: Test token expiration
  - Create account but wait 25 hours
  - Try to verify - should fail
  - Request new verification token (if implemented)

- [ ] **5.1.4**: Test error cases
  - Duplicate username
  - Duplicate email
  - Invalid token
  - Expired token
  - Weak password

### 5.2: Database Verification

- [ ] **5.2.1**: Check `_users` DB directly to verify:
  - Email field populated
  - Status field correct
  - Tokens stored/cleared properly
  - Password updated correctly

## Resolved Design Questions

**Token expiry durations**:
- Verification: 24 hours ✅
- Password reset: 1 hour ✅
- No configuration needed (can update if needed later)

**Password update mechanism**:
- Express backend with admin credentials updates `_users` DB directly ✅
- Use CouchDB API to update password hash fields

**User lookup by email**:
- Design doc with email index view ✅
- See Express code for prior art on applying design docs

**Architecture separation**:
- Keep `@db` pure (no Express dependencies) ✅
- Auth flows in `common-ui` composables
- Express handles server-side operations

## Dependencies

**No new dependencies needed:**
- `crypto` (Node.js built-in) - for token generation in Express
- `cross-fetch` (already in common-ui via dependencies) - for API calls
- CouchDB admin credentials (already configured in Express)

## Post-Implementation TODOs

These items were identified during implementation and are tracked inline in the code. They require additional work outside the scope of the current implementation.

### 6.1: Email Service Integration

**File**: `packages/express/src/services/email.ts`

- [ ] **6.1.1**: Replace console.log stub with actual email provider
  - Location: Lines 26-39, 58-71
  - Options: SendGrid, AWS SES, Resend, Postmark, etc.
  - Required environment variables: API keys, sender addresses
  - Note: This is being handled in separate email infrastructure work
  - ✅ **Multi-frontend support**: Both functions now accept optional `origin` parameter
    - Priority: `origin` param → `APP_URL` env var → localhost fallback
    - Allows multiple frontends (platform-ui, scaffolded courses) to receive correct links
    - Example: `sendVerificationEmail(email, token, 'https://course.example.com')`

### 6.2: Password Update Implementation

**File**: `packages/express/src/routes/auth.ts`

- [ ] **6.2.1**: Implement actual password update in CouchDB `_users` DB
  - Location: Lines 189-194
  - Requires: CouchDB admin API access to update PBKDF2 fields
  - Fields to update: `derived_key`, `salt`, `iterations`
  - Security: Must use proper password hashing (PBKDF2 with CouchDB-compatible params)
  - Current behavior: Flow completes but password is NOT actually changed
  - Related: Line 205 warning message should be removed after implementation

### 6.3: Security Hardening ✅

**File**: `packages/express/src/couchdb/userLookup.ts`

- [x] **6.3.1**: Mitigate Loop Bound Injection vulnerability
  - ✅ Added `MAX_USERNAME_LENGTH = 256` validation in `hexEncode()` function
  - ✅ Prevents DoS attacks via extremely long usernames
  - ✅ Cached `str.length` to avoid repeated property access
  - ✅ Throws descriptive error if username exceeds limit
  - Location: Lines 31-50
  - CodeQL Alert: High severity - Loop bound injection - **RESOLVED**

### 6.4: Future Enhancements (Not Blocking)

- [ ] **6.4.1**: Add "resend verification email" functionality
  - Allow users to request new verification token if original expires
  - Could be triggered from login page or separate endpoint

- [ ] **6.4.2**: Add rate limiting to auth endpoints
  - Prevent brute force attacks on password reset
  - Limit verification email sends per user per time window

- [ ] **6.4.3**: Add email templates with HTML formatting
  - Currently using plain text console output
  - Move to proper email templates when integrating email service

- [ ] **6.4.4**: Track verification/reset attempts in user doc
  - Add `verificationAttempts`, `resetAttempts` counters
  - Implement lockout after excessive failed attempts

- [ ] **6.4.5**: Add email change flow
  - Allow verified users to update their email address
  - Require verification of new email before switching

- [ ] **6.4.6**: Add origin whitelist validation
  - Validate `origin` parameter against allowed domains
  - Prevents malicious actors from providing fake origins in API calls
  - See `a.8.multi-frontend-support.md` for implementation example
