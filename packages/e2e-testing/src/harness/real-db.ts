/**
 * Real Database Setup for E2E Tests
 *
 * This module provides utilities to set up real CouchDB-backed
 * database interfaces for end-to-end testing.
 *
 * Unlike the mock implementations, these use actual @vue-skuilder/db
 * components connected to a running CouchDB instance.
 */

import PouchDB from 'pouchdb';
import memoryAdapter from 'pouchdb-adapter-memory';
import {
  initializeDataLayer,
  _resetDataLayer,
  ENV,
  DataLayerConfig,
} from '@vue-skuilder/db';

// Register memory adapter for faster tests when CouchDB not needed
PouchDB.plugin(memoryAdapter);

/**
 * CouchDB connection configuration for tests.
 */
export interface CouchDBTestConfig {
  serverUrl: string;
  protocol: 'http' | 'https';
  username: string;
  password: string;
}

/**
 * Default test configuration for local CouchDB.
 * Assumes Docker container from `yarn couchdb:start`.
 */
export const DEFAULT_COUCH_CONFIG: CouchDBTestConfig = {
  serverUrl: 'localhost:5984/',
  protocol: 'http',
  username: 'admin',
  password: 'password',
};

/**
 * Result of initializing a real test environment.
 */
export interface RealTestEnvironment {
  /** Data layer provider */
  dataLayer: Awaited<ReturnType<typeof initializeDataLayer>>;
  /** Course ID for this test */
  courseId: string;
  /** Cleanup function - MUST be called in afterEach/afterAll */
  cleanup: () => Promise<void>;
}

/**
 * Configure the ENV for CouchDB access.
 * Must be called before any db operations.
 */
export function configureCouchDBEnv(config: CouchDBTestConfig = DEFAULT_COUCH_CONFIG): void {
  ENV.COUCHDB_SERVER_PROTOCOL = config.protocol;
  ENV.COUCHDB_SERVER_URL = config.serverUrl;
  ENV.COUCHDB_USERNAME = config.username;
  ENV.COUCHDB_PASSWORD = config.password;
}

/**
 * Initialize a real data layer for E2E tests.
 *
 * This creates a connection to CouchDB and returns a fully
 * functional DataLayerProvider.
 *
 * @param courseIds - Course IDs to register (will be created if needed)
 * @param config - CouchDB connection config
 */
export async function initializeRealDataLayer(
  courseIds: string[],
  config: CouchDBTestConfig = DEFAULT_COUCH_CONFIG
): Promise<RealTestEnvironment> {
  // Reset any existing data layer
  await _resetDataLayer();

  const dataLayerConfig: DataLayerConfig = {
    type: 'couch',
    options: {
      COUCHDB_SERVER_URL: config.serverUrl,
      COUCHDB_SERVER_PROTOCOL: config.protocol,
      COUCHDB_USERNAME: config.username,
      COUCHDB_PASSWORD: config.password,
      COURSE_IDS: courseIds,
    },
  };

  const dataLayer = await initializeDataLayer(dataLayerConfig);

  return {
    dataLayer,
    courseId: courseIds[0] || 'test-course',
    cleanup: async () => {
      await _resetDataLayer();
    },
  };
}

/**
 * Create a unique test course ID to avoid collisions.
 */
export function createTestCourseId(prefix = 'e2e-test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Wait for CouchDB to be ready.
 *
 * @param config - CouchDB config
 * @param maxAttempts - Maximum retry attempts
 * @param delayMs - Delay between attempts
 */
export async function waitForCouchDB(
  config: CouchDBTestConfig = DEFAULT_COUCH_CONFIG,
  maxAttempts = 30,
  delayMs = 1000
): Promise<boolean> {
  // Build URL without credentials (use Authorization header instead)
  const serverUrl = config.serverUrl.replace(/\/$/, '');
  const url = `${config.protocol}://${serverUrl}`;
  
  // Create Basic Auth header
  const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${credentials}`,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, { headers });
      if (response.ok) {
        console.log(`[real-db] CouchDB ready after ${attempt} attempt(s)`);
        return true;
      }
    } catch {
      // Connection failed, retry
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.error(`[real-db] CouchDB not ready after ${maxAttempts} attempts`);
  return false;
}

/**
 * Create a raw PouchDB connection to a course database.
 * Useful for direct database manipulation in tests.
 */
export function createRawCourseDB(
  courseId: string,
  config: CouchDBTestConfig = DEFAULT_COUCH_CONFIG
): PouchDB.Database {
  const serverUrl = config.serverUrl.replace(/\/$/, '');
  const url = `${config.protocol}://${config.username}:${config.password}@${serverUrl}/coursedb-${courseId}`;
  return new PouchDB(url);
}

/**
 * Create a raw PouchDB connection to a user database.
 */
export function createRawUserDB(
  username: string,
  config: CouchDBTestConfig = DEFAULT_COUCH_CONFIG
): PouchDB.Database {
  const hexName = hexEncode(username);
  const serverUrl = config.serverUrl.replace(/\/$/, '');
  const url = `${config.protocol}://${config.username}:${config.password}@${serverUrl}/userdb-${hexName}`;
  return new PouchDB(url);
}

/**
 * Hex encode a string (for CouchDB user database names).
 */
function hexEncode(str: string): string {
  let returnStr = '';
  for (let i = 0; i < str.length; i++) {
    const hex = str.charCodeAt(i).toString(16);
    returnStr += ('000' + hex).slice(-4);
  }
  return returnStr;
}

/**
 * Delete a test course database.
 * Use with caution - only for cleanup.
 */
export async function deleteTestCourseDB(
  courseId: string,
  config: CouchDBTestConfig = DEFAULT_COUCH_CONFIG
): Promise<void> {
  const db = createRawCourseDB(courseId, config);
  try {
    await db.destroy();
    console.log(`[real-db] Deleted course database: coursedb-${courseId}`);
  } catch (error: unknown) {
    const err = error as { status?: number };
    if (err.status !== 404) {
      throw error;
    }
    // Database didn't exist, that's fine
  }
}

/**
 * Delete a test user database.
 */
export async function deleteTestUserDB(
  username: string,
  config: CouchDBTestConfig = DEFAULT_COUCH_CONFIG
): Promise<void> {
  const db = createRawUserDB(username, config);
  try {
    await db.destroy();
    console.log(`[real-db] Deleted user database: userdb-${hexEncode(username)}`);
  } catch (error: unknown) {
    const err = error as { status?: number };
    if (err.status !== 404) {
      throw error;
    }
  }
}

/**
 * Insert a card document directly into a course database.
 */
export async function insertTestCard(
  courseId: string,
  card: {
    _id?: string;
    id_datashape: string;
    data: unknown;
    tags?: string[];
    elo?: { score: number };
  },
  config: CouchDBTestConfig = DEFAULT_COUCH_CONFIG
): Promise<string> {
  const db = createRawCourseDB(courseId, config);
  const id = card._id || `CARD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await db.put({
    _id: id,
    docType: 'CARD',
    id_datashape: card.id_datashape,
    data: card.data,
    tags: card.tags || [],
    elo: card.elo,
  });

  return id;
}

/**
 * Insert a navigation strategy document directly.
 */
export async function insertTestStrategy(
  courseId: string,
  strategy: {
    _id?: string;
    name: string;
    implementingClass: string;
    description?: string;
    serializedData?: string;
  },
  config: CouchDBTestConfig = DEFAULT_COUCH_CONFIG
): Promise<string> {
  const db = createRawCourseDB(courseId, config);
  const id = strategy._id || `NAVIGATION_STRATEGY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await db.put({
    _id: id,
    docType: 'NAVIGATION_STRATEGY',
    name: strategy.name,
    implementingClass: strategy.implementingClass,
    description: strategy.description || `Test strategy: ${strategy.name}`,
    serializedData: strategy.serializedData,
  });

  return id;
}

/**
 * Insert minimal course config to make a course valid.
 */
export async function insertTestCourseConfig(
  courseId: string,
  config: CouchDBTestConfig = DEFAULT_COUCH_CONFIG
): Promise<void> {
  const db = createRawCourseDB(courseId, config);

  try {
    await db.put({
      _id: 'CourseConfig',
      docType: 'COURSE_CONFIG',
      name: `Test Course ${courseId}`,
      description: 'E2E test course',
      courseId: courseId,
      admins: [],
      moderators: [],
      public: true,
      deleted: false,
      creator: 'e2e-test',
      dataShapes: [],
      questionTypes: [],
    });
  } catch (error: unknown) {
    const err = error as { status?: number };
    if (err.status !== 409) {
      // 409 = conflict, doc already exists - that's okay
      throw error;
    }
  }
}

/**
 * Insert required design documents for a course database.
 * These are necessary for queries like getCardsByELO to work.
 */
export async function insertTestDesignDocs(
  courseId: string,
  config: CouchDBTestConfig = DEFAULT_COUCH_CONFIG
): Promise<void> {
  const db = createRawCourseDB(courseId, config);

  // ELO design doc - required for ELO-based card queries
  const eloDesignDoc = {
    _id: '_design/elo',
    views: {
      elo: {
        map: `function (doc) {
          if (doc.docType && doc.docType === 'CARD') {
            if (doc.elo && typeof(doc.elo) === 'number') {
              emit(doc.elo, doc._id);
            } else if (doc.elo && doc.elo.global) {
              emit(doc.elo.global.score, doc._id);
            } else if (doc.elo) {
              emit(doc.elo.score, doc._id);
            } else {
              var randElo = 995 + Math.round(10 * Math.random());
              emit(randElo, doc._id);
            }
          }
        }`,
      },
    },
    language: 'javascript',
  };

  // getTags design doc - required for tag queries
  const getTagsDesignDoc = {
    _id: '_design/getTags',
    views: {
      getTags: {
        map: `function (doc) {
          if (doc.docType && doc.docType === "TAG") {
            for (var cardIndex in doc.taggedCards) {
              emit(doc.taggedCards[cardIndex], {
                docType: doc.docType,
                name: doc.name,
                snippit: doc.snippit,
                wiki: '',
                taggedCards: []
              });
            }
          }
        }`,
      },
    },
    language: 'javascript',
  };

  try {
    await db.put(eloDesignDoc);
    console.log(`[real-db] Created _design/elo for coursedb-${courseId}`);
  } catch (error: unknown) {
    const err = error as { status?: number };
    if (err.status !== 409) {
      // 409 = conflict, doc already exists - that's okay
      throw error;
    }
  }

  try {
    await db.put(getTagsDesignDoc);
    console.log(`[real-db] Created _design/getTags for coursedb-${courseId}`);
  } catch (error: unknown) {
    const err = error as { status?: number };
    if (err.status !== 409) {
      // 409 = conflict, doc already exists - that's okay
      throw error;
    }
  }
}

// Note: PipelineAssembler should be imported directly from
// '@vue-skuilder/db' or the specific path where it's exported.
// Currently it's not exported from /core, so tests should import it as:
// import { PipelineAssembler } from '@vue-skuilder/db/core/navigators/PipelineAssembler';