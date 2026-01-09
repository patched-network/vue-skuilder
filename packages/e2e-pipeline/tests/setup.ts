/**
 * Jest global setup for e2e-pipeline tests.
 *
 * This file runs once before all tests in the suite.
 * Use it for global initialization that should happen once.
 */

export default async function globalSetup(): Promise<void> {
  // Set up any global test environment
  console.log('[e2e-pipeline] Global setup starting...');

  // Set timezone for consistent date handling
  process.env.TZ = 'UTC';

  // Increase max listeners to avoid warnings with many concurrent tests
  process.setMaxListeners(20);

  // Store start time for performance tracking
  (globalThis as Record<string, unknown>).__TEST_START_TIME__ = Date.now();

  console.log('[e2e-pipeline] Global setup complete');
}