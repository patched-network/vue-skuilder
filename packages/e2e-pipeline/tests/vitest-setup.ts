/**
 * Vitest setup file for e2e-pipeline tests.
 *
 * This file runs before each test file.
 * Use it for global initialization and cleanup hooks.
 */

import { beforeAll, afterAll } from 'vitest';

// Store start time for performance tracking at module level
let suiteStartTime: number;

beforeAll(() => {
  // Set up any global test environment
  console.log('[e2e-pipeline] Test suite starting...');

  // Set timezone for consistent date handling
  process.env.TZ = 'UTC';

  // Increase max listeners to avoid warnings with many concurrent tests
  process.setMaxListeners(20);

  // Store start time for performance tracking
  suiteStartTime = Date.now();
});

afterAll(() => {
  console.log('[e2e-pipeline] Test suite teardown...');

  // Calculate and report total test duration
  if (suiteStartTime) {
    const duration = Date.now() - suiteStartTime;
    const seconds = (duration / 1000).toFixed(2);
    console.log(`[e2e-pipeline] Test suite duration: ${seconds}s`);
  }

  console.log('[e2e-pipeline] Test suite teardown complete');
});