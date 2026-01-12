/**
 * Test harness utilities for e2e-pipeline tests.
 *
 * Provides database lifecycle management, MCP client wrappers,
 * and determinism utilities.
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
  TestMCPClient,
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
  insertTestDesignDocs,
} from './real-db';
