/**
 * Determinism utilities for reproducible tests.
 *
 * These utilities allow tests to control Math.random() behavior,
 * ensuring deterministic outcomes for probability-based code.
 */

/**
 * Seed Math.random() for deterministic tests.
 * Uses a simple LCG (Linear Congruential Generator) for reproducibility.
 *
 * @param seed - Initial seed value
 * @returns Restore function to return Math.random to original behavior
 *
 * @example
 * ```typescript
 * const restore = seedRandom(12345);
 * try {
 *   // All Math.random() calls are now deterministic
 *   const value = Math.random(); // Always same for seed 12345
 * } finally {
 *   restore();
 * }
 * ```
 */
export function seedRandom(seed: number): () => void {
  let state = seed;

  const originalRandom = Math.random;

  Math.random = () => {
    // LCG parameters from Numerical Recipes
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  // Return restore function
  return () => {
    Math.random = originalRandom;
  };
}

/**
 * Create a sequence of predetermined random values.
 * Useful for testing specific probability branches.
 *
 * The sequence cycles if more values are requested than provided.
 *
 * @param values - Array of values to return (should be 0-1 range)
 * @returns Restore function to return Math.random to original behavior
 *
 * @example
 * ```typescript
 * // Force specific random outcomes
 * const restore = mockRandomSequence([0.1, 0.5, 0.9]);
 * try {
 *   Math.random(); // 0.1
 *   Math.random(); // 0.5
 *   Math.random(); // 0.9
 *   Math.random(); // 0.1 (cycles)
 * } finally {
 *   restore();
 * }
 * ```
 */
export function mockRandomSequence(values: number[]): () => void {
  if (values.length === 0) {
    throw new Error('[determinism] mockRandomSequence requires at least one value');
  }

  let index = 0;
  const originalRandom = Math.random;

  Math.random = () => {
    const value = values[index % values.length];
    index++;
    return value;
  };

  return () => {
    Math.random = originalRandom;
  };
}

/**
 * Create a mock that tracks random call count.
 * Useful for verifying how many random decisions were made.
 *
 * @param seed - Seed for reproducible values
 * @returns Object with restore function and call count getter
 */
export function trackRandomCalls(seed: number): {
  restore: () => void;
  getCallCount: () => number;
} {
  let state = seed;
  let callCount = 0;

  const originalRandom = Math.random;

  Math.random = () => {
    callCount++;
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  return {
    restore: () => {
      Math.random = originalRandom;
    },
    getCallCount: () => callCount,
  };
}

/**
 * Run a function with seeded randomness, automatically restoring afterward.
 *
 * @param seed - Seed for reproducibility
 * @param fn - Function to run with deterministic randomness
 * @returns Result of the function
 */
export async function withSeededRandom<T>(seed: number, fn: () => T | Promise<T>): Promise<T> {
  const restore = seedRandom(seed);
  try {
    return await fn();
  } finally {
    restore();
  }
}

/**
 * Run a function with a specific random sequence, automatically restoring afterward.
 *
 * @param values - Sequence of random values
 * @param fn - Function to run
 * @returns Result of the function
 */
export async function withRandomSequence<T>(
  values: number[],
  fn: () => T | Promise<T>
): Promise<T> {
  const restore = mockRandomSequence(values);
  try {
    return await fn();
  } finally {
    restore();
  }
}