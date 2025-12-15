/**
 * Grades a spelling attempt against the correct answer.
 * Returns a string showing which letters were correct vs missed.
 *
 * Algorithm:
 * 1. First pass: Match characters in correct positions exactly
 * 2. Second pass: Match remaining characters from right to left (for transposed letters)
 *
 * @param attempt - The user's attempted spelling
 * @param answer - The correct answer
 * @returns A spaced string showing matched letters and underscores for misses
 *
 * @example
 * gradeSpellingAttempt("helo", "hello") // "h e l _ o"
 * gradeSpellingAttempt("wrold", "world") // "w _ _ l d" (transposed letters partially matched)
 */
export function gradeSpellingAttempt(attempt: string, answer: string): string {
  const result: string[] = new Array(answer.length).fill('_');
  const attemptChars = attempt.split('');

  // First pass: match characters in correct positions
  for (let i = 0; i < answer.length; i++) {
    if (i < attemptChars.length && attemptChars[i] === answer[i]) {
      result[i] = attemptChars[i];
      attemptChars[i] = '';
    }
  }

  // Second pass: match remaining characters from right to left
  for (let i = answer.length - 1; i >= 0; i--) {
    if (result[i] === '_') {
      const charIndex = attemptChars.findIndex((char) => char === answer[i]);
      if (charIndex !== -1) {
        result[i] = answer[i];
        attemptChars[charIndex] = '';
      }
    }
  }

  return result.join(' ');
}

/**
 * Generates an obscured version of the answer (all underscores)
 * Used when no prior attempt exists
 *
 * @param answer - The answer to obscure
 * @returns Spaced underscores matching the answer length
 */
export function obscureAnswer(answer: string): string {
  return answer
    .split('')
    .map(() => '_')
    .join(' ');
}

export default gradeSpellingAttempt;
