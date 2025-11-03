/**
 * Centralized utility for checking if user registration is enabled.
 * Registration is disabled for the production deployment at eduquilt.com
 * to restrict access to testing/family use only.
 */

const REGISTRATION_DISABLED_HOSTS = new Set([
  'eduquilt.com',
  'www.eduquilt.com',
]);

export function isRegistrationEnabled(): boolean {
  try {
    const url = new URL(window.location.href);
    return !REGISTRATION_DISABLED_HOSTS.has(url.hostname);
  } catch {
    // If URL parsing fails, default to allowing registration (safer fallback)
    return true;
  }
}
