/**
 * Authentication API service for interacting with Express backend auth endpoints.
 * Uses relative paths (same-origin) to avoid ENV coupling.
 */

export interface AuthResponse {
  ok: boolean;
  error?: string;
}

export interface VerifyEmailResponse extends AuthResponse {
  username?: string;
}

/**
 * Triggers verification email send for a newly created account.
 * Express backend will read email from userdb-{username}/CONFIG
 * and send verification email with token.
 *
 * @param username - Username of the newly created account
 * @param origin - Optional frontend origin URL (e.g., window.location.origin)
 *                 Used to construct the correct verification link in the email.
 *                 If not provided, backend falls back to APP_URL env var.
 */
export async function sendVerificationEmail(
  username: string,
  origin?: string
): Promise<AuthResponse> {
  try {
    const body: { username: string; origin?: string } = { username };
    if (origin) {
      body.origin = origin;
    }

    const response = await fetch('/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Verify user email using token from magic link.
 */
export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  try {
    const response = await fetch('/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Request password reset email for user identified by email.
 *
 * @param email - User's email address
 * @param origin - Optional frontend origin URL (e.g., window.location.origin)
 *                 Used to construct the correct password reset link in the email.
 *                 If not provided, backend falls back to APP_URL env var.
 */
export async function requestPasswordReset(
  email: string,
  origin?: string
): Promise<AuthResponse> {
  try {
    const body: { email: string; origin?: string } = { email };
    if (origin) {
      body.origin = origin;
    }

    const response = await fetch('/auth/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Reset password using token from magic link.
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<AuthResponse> {
  try {
    const response = await fetch('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, newPassword }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
