import { beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabaseManager } from './database';
import { TestDataFactory } from '../helpers/test-data-factory';

// Global test state
let databaseManager: DatabaseManager;
let testDataFactory: TestDataFactory;

// Extend Jest's expect with custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toExistInDatabase(): R;
      toBeRemovedFromDatabase(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  async toExistInDatabase(received: { username: string; documentId: string }) {
    const exists = await databaseManager.documentExists(received.username, received.documentId);
    return {
      message: () =>
        `Expected document ${received.documentId} to ${
          this.isNot ? 'not ' : ''
        }exist in database for user ${received.username}`,
      pass: exists,
    };
  },

  async toBeRemovedFromDatabase(received: { username: string; documentId: string }) {
    const exists = await databaseManager.documentExists(received.username, received.documentId);
    return {
      message: () =>
        `Expected document ${received.documentId} to be removed from database for user ${received.username}`,
      pass: !exists,
    };
  },
});

beforeAll(async () => {
  console.log('🚀 Starting e2e-db test suite...');

  // Initialize database manager
  databaseManager = new DatabaseManager('http://localhost:5984');
  await databaseManager.waitForDatabase();

  // Initialize test data factory
  testDataFactory = new TestDataFactory();

  // Make globally available
  (global as any).databaseManager = databaseManager;
  (global as any).testDataFactory = testDataFactory;

  console.log('✅ Test environment ready');
}, 60000);

beforeEach(async () => {
  // Clean up any test data before each test
  await databaseManager.cleanupTestData();
});

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');

  // Final cleanup
  if (databaseManager) {
    await databaseManager.cleanupAll();
  }

  console.log('✅ Test cleanup complete');
});

// Error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
