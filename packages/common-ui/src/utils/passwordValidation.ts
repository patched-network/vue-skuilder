/**
 * Simple password validation utilities.
 *
 * Requirements:
 * - At least 6 characters
 * - At least 2 distinct characters
 */

export function validatePassword(password: string): string {
  if (!password) return '';

  // At least 6 characters
  if (password.length < 6) {
    return 'Password must be at least 6 characters';
  }

  // At least 2 distinct characters
  const uniqueChars = new Set(password).size;
  if (uniqueChars < 2) {
    return 'Password must contain at least 2 different characters';
  }

  return '';
}

/**
 * Check if password is valid (no error message)
 */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password) === '';
}
