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

export interface UserStatusResponse extends AuthResponse {
  username?: string;
  status?: 'pending_verification' | 'verified' | 'suspended';
  email?: string | null;
}

/**
 * Triggers verification email send for a newly created account.
 *
 * @param username - Username of the newly created account
 * @param email - User's email address (passed directly to avoid race conditions with DB sync)
 * @param origin - Optional frontend origin URL (e.g., window.location.origin)
 *                 Used to construct the correct verification link in the email.
 *                 If not provided, backend falls back to APP_URL env var.
 */
export async function sendVerificationEmail(
  username: string,
  email: string,
  origin?: string
): Promise<AuthResponse> {
  try {
    const body: { username: string; email: string; origin?: string } = { username, email };
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
      const errorText = await response.text();
      console.error('Send verification email error:', errorText);
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Send verification email fetch error:', error);
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
 * Get current user's account status (verification status, email).
 * Requires valid AuthSession cookie.
 */
export async function getUserStatus(): Promise<UserStatusResponse> {
  try {
    const response = await fetch('/auth/status', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
