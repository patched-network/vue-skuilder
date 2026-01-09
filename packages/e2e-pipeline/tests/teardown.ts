/**
 * Jest global teardown for e2e-pipeline tests.
 *
 * This file runs once after all tests in the suite complete.
 * Use it for global cleanup and reporting.
 */

export default async function globalTeardown(): Promise<void> {
  console.log('[e2e-pipeline] Global teardown starting...');

  // Calculate and report total test duration
  const startTime = (globalThis as Record<string, unknown>).__TEST_START_TIME__ as
    | number
    | undefined;
  if (startTime) {
    const duration = Date.now() - startTime;
    const seconds = (duration / 1000).toFixed(2);
    console.log(`[e2e-pipeline] Total test suite duration: ${seconds}s`);
  }

  // Clean up any global resources
  // Note: Individual test cleanup should happen in afterEach/afterAll hooks
  // This is for truly global cleanup only

  console.log('[e2e-pipeline] Global teardown complete');
}