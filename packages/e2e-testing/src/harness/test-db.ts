import PouchDB from 'pouchdb';
import memoryAdapter from 'pouchdb-adapter-memory';

// Register the memory adapter
PouchDB.plugin(memoryAdapter);

/**
 * Represents a test database pair for course and user data.
 */
export interface TestDatabase {
  /** Course database instance */
  courseDB: PouchDB.Database;
  /** User database instance */
  userDB: PouchDB.Database;
  /** Cleanup function to destroy databases after test */
  cleanup: () => Promise<void>;
}

/**
 * Create ephemeral in-memory databases for a test.
 * No Docker required - fastest option for unit tests.
 *
 * @param testId - Unique identifier for this test (prevents collisions)
 * @returns TestDatabase with memory-backed PouchDB instances
 */
export async function createMemoryTestDB(testId: string): Promise<TestDatabase> {
  const timestamp = Date.now();
  const courseDB = new PouchDB(`test-course-${testId}-${timestamp}`, { adapter: 'memory' });
  const userDB = new PouchDB(`test-user-${testId}-${timestamp}`, { adapter: 'memory' });

  return {
    courseDB,
    userDB,
    cleanup: async () => {
      await courseDB.destroy();
      await userDB.destroy();
    },
  };
}

/**
 * Create real CouchDB databases for integration tests.
 * Requires Docker container running (yarn couchdb:start).
 *
 * @param testId - Unique identifier for this test
 * @param serverUrl - CouchDB server URL with credentials
 * @returns TestDatabase with CouchDB-backed instances
 */
export async function createCouchTestDB(
  testId: string,
  serverUrl = 'http://admin:password@localhost:5984'
): Promise<TestDatabase> {
  const timestamp = Date.now();
  const courseDbName = `coursedb-test-${testId}-${timestamp}`;
  const userDbName = `userdb-test-${testId}-${timestamp}`;

  const courseDB = new PouchDB(`${serverUrl}/${courseDbName}`);
  const userDB = new PouchDB(`${serverUrl}/${userDbName}`);

  // Verify connection by getting info
  try {
    await courseDB.info();
    await userDB.info();
  } catch (error) {
    // Clean up on failure
    await courseDB.destroy().catch(() => {});
    await userDB.destroy().catch(() => {});
    throw new Error(
      `[test-db] Failed to connect to CouchDB at ${serverUrl}. ` +
        `Ensure Docker container is running (yarn couchdb:start). Error: ${error}`
    );
  }

  return {
    courseDB,
    userDB,
    cleanup: async () => {
      await courseDB.destroy();
      await userDB.destroy();
    },
  };
}

/**
 * Seed a test database with initial documents.
 *
 * @param db - PouchDB instance to seed
 * @param docs - Documents to insert (must have _id)
 */
export async function seedDatabase(
  db: PouchDB.Database,
  docs: Array<{ _id: string; [key: string]: unknown }>
): Promise<void> {
  for (const doc of docs) {
    await db.put(doc);
  }
}

/**
 * Get all documents from a database (excluding design docs).
 *
 * @param db - PouchDB instance
 * @returns Array of document objects
 */
export async function getAllDocs(db: PouchDB.Database): Promise<unknown[]> {
  const result = await db.allDocs({ include_docs: true });
  return result.rows
    .filter((row) => !row.id.startsWith('_design/'))
    .map((row) => row.doc);
}