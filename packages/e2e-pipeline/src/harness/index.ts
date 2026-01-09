/**
 * Test harness utilities for e2e-pipeline tests.
 *
 * Provides database lifecycle management, MCP client wrappers,
 * determinism utilities, and data layer factories.
 */

// Database lifecycle management
export {
  TestDatabase,
  createMemoryTestDB,
  createCouchTestDB,
  seedDatabase,
  getAllDocs,
} from './test-db';

// MCP client wrapper
export {
  TestMCPClient, // unused
  CreateCardParams,
  CreateCardResult,
  CreateStrategyParams,
  CreateStrategyResult,
  createTestMCPClient,
} from './mcp-client';

// Determinism utilities for reproducible tests
export {
  seedRandom,
  mockRandomSequence,
  trackRandomCalls,
  withSeededRandom,
  withRandomSequence,
} from './determinism';

// Data layer factory for tests (mock implementations)
export {
  TestCourseDB,
  TestUserDB,
  TestDataLayerProvider,
  TestEnvironment,
  TestEnvironmentOptions,
  createTestDataLayer,
  createTestEnvironment,
} from './data-layer-factory';

// Real CouchDB-backed database utilities for E2E tests
export {
  CouchDBTestConfig,
  RealTestEnvironment,
  DEFAULT_COUCH_CONFIG,
  configureCouchDBEnv,
  initializeRealDataLayer,
  createTestCourseId,
  waitForCouchDB,
  createRawCourseDB,
  createRawUserDB,
  deleteTestCourseDB,
  deleteTestUserDB,
  insertTestCard,
  insertTestStrategy,
  insertTestCourseConfig,
} from './real-db';
