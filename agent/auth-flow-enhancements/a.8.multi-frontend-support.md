# Multi-Frontend Support for Auth Flows

## Problem Statement

The CouchDB and Express backend infrastructure serves multiple frontends:
- `platform-ui` at `https://eduquilt.com`
- Scaffolded courses at various domains (e.g., `https://course.example.com`)
- Standalone deployments at custom domains

When users register or request password resets, the verification/reset links in emails must point to the **originating frontend**, not a hardcoded URL.

## Solution

All auth endpoints and API functions now accept an optional `origin` parameter that specifies the frontend's base URL for constructing email links.

## Implementation Details

### Backend Changes

#### 1. Express Routes (`packages/express/src/routes/auth.ts`)

Both email-triggering endpoints now accept optional `origin` in request body:

**POST `/auth/send-verification`**
```typescript
Body: {
  username: string;      // Required
  origin?: string;       // Optional - e.g., 'https://course.example.com'
}
```

**POST `/auth/request-reset`**
```typescript
Body: {
  email: string;         // Required
  origin?: string;       // Optional - e.g., 'https://course.example.com'
}
```

#### 2. Email Service (`packages/express/src/services/email.ts`)

Updated function signatures to accept and use `origin`:

```typescript
export async function sendVerificationEmail(
  to: string,
  token: string,
  origin?: string  // NEW PARAMETER
): Promise<void>

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  origin?: string  // NEW PARAMETER
): Promise<void>
```

**Link Construction Priority:**
1. `origin` parameter (if provided)
2. `APP_URL` environment variable (fallback)
3. `http://localhost:5173` (development fallback)

**Example:**
```typescript
// Origin provided: https://course.example.com
// Generated link: https://course.example.com/verify?token=abc123

// No origin, APP_URL=https://eduquilt.com
// Generated link: https://eduquilt.com/verify?token=abc123

// No origin, no APP_URL (dev)
// Generated link: http://localhost:5173/verify?token=abc123
```

### Frontend Changes

#### 1. Auth API Service (`packages/common-ui/src/services/authAPI.ts`)

Updated function signatures to accept and pass `origin`:

```typescript
export async function sendVerificationEmail(
  username: string,
  origin?: string  // NEW PARAMETER
): Promise<AuthResponse>

export async function requestPasswordReset(
  email: string,
  origin?: string  // NEW PARAMETER
): Promise<AuthResponse>
```

#### 2. Components

**UserRegistration.vue** (lines 177-180)
```typescript
// Pass current origin for correct verification link
const origin = typeof window !== 'undefined'
  ? window.location.origin
  : undefined;
const verificationResult = await sendVerificationEmail(this.username, origin);
```

**RequestPasswordReset.vue** (lines 107-109)
```typescript
// Pass current origin for correct reset link in email
const origin = typeof window !== 'undefined'
  ? window.location.origin
  : undefined;
const result = await requestPasswordReset(this.email, origin);
```

## Usage Examples

### Example 1: Platform-UI (eduquilt.com)

User registers at `https://eduquilt.com`:
1. Browser: `window.location.origin = 'https://eduquilt.com'`
2. Frontend calls: `sendVerificationEmail(username, 'https://eduquilt.com')`
3. Backend receives: `{ username, origin: 'https://eduquilt.com' }`
4. Email link generated: `https://eduquilt.com/verify?token=...`

### Example 2: Scaffolded Course (custom domain)

User registers at `https://music-theory-101.com`:
1. Browser: `window.location.origin = 'https://music-theory-101.com'`
2. Frontend calls: `sendVerificationEmail(username, 'https://music-theory-101.com')`
3. Backend receives: `{ username, origin: 'https://music-theory-101.com' }`
4. Email link generated: `https://music-theory-101.com/verify?token=...`

### Example 3: Development (localhost)

Developer testing locally:
1. Browser: `window.location.origin = 'http://localhost:5173'`
2. Frontend calls: `sendVerificationEmail(username, 'http://localhost:5173')`
3. Backend receives: `{ username, origin: 'http://localhost:5173' }`
4. Email link generated: `http://localhost:5173/verify?token=...`

### Example 4: Legacy Usage (no origin provided)

Older code that doesn't pass origin:
1. Frontend calls: `sendVerificationEmail(username)` (no second param)
2. Backend receives: `{ username }` (no origin)
3. Backend falls back to `APP_URL` env var
4. Email link generated: `${process.env.APP_URL}/verify?token=...`

## Backward Compatibility

✅ **Fully backward compatible**: The `origin` parameter is optional on all endpoints and functions. Existing code that doesn't provide it will continue to work, falling back to `APP_URL` environment variable.

## Testing Considerations

When testing auth flows:
1. Check console output for "Origin: ..." in email stub logs
2. Verify the constructed links point to the correct frontend
3. Test with and without `origin` parameter to verify fallback behavior
4. Confirm multiple frontends can coexist with same backend

## Security Notes

- The `origin` parameter is **not validated** against a whitelist in current implementation
- When integrating real email service, consider validating `origin` against allowed domains
- Prevents potential abuse where malicious actors provide fake origins in API calls
- Example validation:
  ```typescript
  const ALLOWED_ORIGINS = [
    'https://eduquilt.com',
    'https://music-theory-101.com',
    /^https:\/\/.*\.eduquilt\.com$/,  // Subdomains
  ];

  function isOriginAllowed(origin: string): boolean {
    return ALLOWED_ORIGINS.some(allowed =>
      allowed instanceof RegExp
        ? allowed.test(origin)
        : allowed === origin
    );
  }
  ```

## Future Enhancements

- [ ] Add origin whitelist validation in Express routes
- [ ] Store user's preferred/registered frontend domain in user doc
- [ ] Support per-course custom email templates based on origin
- [ ] Track which frontend each user registered from for analytics
