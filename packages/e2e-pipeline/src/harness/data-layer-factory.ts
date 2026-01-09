/**
 * Data layer factory for tests.
 *
 * Provides utilities to create test database interfaces
 * for testing with in-memory PouchDB.
 */

import PouchDB from 'pouchdb';
import memoryAdapter from 'pouchdb-adapter-memory';

// Register memory adapter
PouchDB.plugin(memoryAdapter);

/**
 * Navigation strategy data structure.
 */
export interface TestNavigationStrategyData {
  _id?: string;
  name: string;
  implementingClass: string;
  description?: string;
  serializedData?: string;
}

/**
 * Minimal CourseDB implementation for testing.
 *
 * Provides the methods needed by Pipeline tests without
 * implementing the full CourseDBInterface.
 */
export class TestCourseDB {
  private db: PouchDB.Database;
  private courseId: string;

  constructor(db: PouchDB.Database, courseId: string) {
    this.db = db;
    this.courseId = courseId;
  }

  getCourseID(): string {
    return this.courseId;
  }

  async getCourseConfig(): Promise<Record<string, unknown>> {
    try {
      const doc = await this.db.get('COURSE_CONFIG');
      return doc as unknown as Record<string, unknown>;
    } catch {
      // Return minimal default config
      return {
        _id: 'COURSE_CONFIG',
        name: `Test Course ${this.courseId}`,
        description: 'Test course for e2e-pipeline tests',
        courseId: this.courseId,
        admins: [],
        public: true,
        deleted: false,
        creator: 'test-user',
        moderators: [],
        dataShapes: [],
        questionTypes: [],
      };
    }
  }

  async getAllNavigationStrategies(): Promise<TestNavigationStrategyData[]> {
    const result = await this.db.allDocs({
      include_docs: true,
      startkey: 'NAVIGATION_STRATEGY-',
      endkey: 'NAVIGATION_STRATEGY-\ufff0',
    });
    return result.rows.map((row) => row.doc as unknown as TestNavigationStrategyData);
  }

  async addNavigationStrategy(
    strategy: Omit<TestNavigationStrategyData, '_id'>
  ): Promise<string> {
    const id = `NAVIGATION_STRATEGY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const doc = { ...strategy, _id: id };
    await this.db.put(doc);
    return id;
  }

  async getCard(cardId: string): Promise<unknown> {
    return this.db.get(cardId);
  }

  async getAllCards(): Promise<unknown[]> {
    const result = await this.db.allDocs({
      include_docs: true,
      startkey: 'CARD-',
      endkey: 'CARD-\ufff0',
    });
    return result.rows.map((row) => row.doc);
  }

  async addCard(card: {
    shape: string;
    data: unknown;
    tags?: string[];
    elo?: number;
  }): Promise<string> {
    const id = `CARD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const doc = {
      _id: id,
      id_datashape: card.shape,
      data: card.data,
      tags: card.tags || [],
      elo: card.elo !== undefined ? { score: card.elo } : undefined,
    };
    await this.db.put(doc);
    return id;
  }

  async getAppliedTags(cardId: string): Promise<string[]> {
    try {
      const doc = await this.db.get<{ tags?: string[] }>(cardId);
      return doc.tags || [];
    } catch {
      return [];
    }
  }

  async getTagsForCards(cardIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    for (const cardId of cardIds) {
      result.set(cardId, await this.getAppliedTags(cardId));
    }
    return result;
  }

  async getCardELO(_cardId: string): Promise<{ score: number }> {
    return { score: 1200 };
  }

  async getQuestionData(_cardId: string): Promise<unknown> {
    return {};
  }
}

/**
 * Minimal UserDB implementation for testing.
 */
export class TestUserDB {
  private userId: string;
  private courseData: Map<string, { elo: number; cardHistory: Map<string, unknown> }> = new Map();

  constructor(userId = 'test-user') {
    this.userId = userId;
  }

  getUserId(): string {
    return this.userId;
  }

  async getUserELO(courseId: string): Promise<number> {
    const data = this.courseData.get(courseId);
    return data?.elo ?? 1200;
  }

  async setUserELO(courseId: string, elo: number): Promise<void> {
    const data = this.courseData.get(courseId) || { elo: 1200, cardHistory: new Map() };
    data.elo = elo;
    this.courseData.set(courseId, data);
  }

  async getCardHistory(_courseId: string, _cardId: string): Promise<unknown> {
    return null;
  }

  async recordCardOutcome(
    _courseId: string,
    _cardId: string,
    _outcome: unknown
  ): Promise<void> {
    // No-op for now
  }

  async getCardRecords(_courseId: string): Promise<unknown[]> {
    return [];
  }

  async getScheduledReviews(_courseId: string): Promise<unknown[]> {
    return [];
  }

  // Method for test setup
  setElo(courseId: string, elo: number): void {
    const data = this.courseData.get(courseId) || { elo: 1200, cardHistory: new Map() };
    data.elo = elo;
    this.courseData.set(courseId, data);
  }
}

/**
 * Test-oriented DataLayerProvider that uses in-memory databases.
 */
export class TestDataLayerProvider {
  private courseDBs: Map<string, TestCourseDB> = new Map();
  private userDBs: Map<string, TestUserDB> = new Map();
  private pouchDBs: Map<string, PouchDB.Database> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async teardown(): Promise<void> {
    for (const db of this.pouchDBs.values()) {
      await db.destroy();
    }
    this.pouchDBs.clear();
    this.courseDBs.clear();
    this.userDBs.clear();
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get or create a course database for testing.
   */
  getCourseDB(courseId: string): TestCourseDB {
    if (!this.courseDBs.has(courseId)) {
      const db = new PouchDB(`test-course-${courseId}-${Date.now()}`, { adapter: 'memory' });
      this.pouchDBs.set(`course-${courseId}`, db);
      this.courseDBs.set(courseId, new TestCourseDB(db, courseId));
    }
    return this.courseDBs.get(courseId)!;
  }

  /**
   * Get or create a user database for testing.
   */
  getUserDB(userId = 'test-user'): TestUserDB {
    if (!this.userDBs.has(userId)) {
      this.userDBs.set(userId, new TestUserDB(userId));
    }
    return this.userDBs.get(userId)!;
  }

  /**
   * Get underlying PouchDB instance for direct manipulation.
   */
  getRawDB(key: string): PouchDB.Database | undefined {
    return this.pouchDBs.get(key);
  }

  getRegisteredCourses(): string[] {
    return Array.from(this.courseDBs.keys());
  }
}

/**
 * Create a fresh test data layer for a single test.
 *
 * @returns TestDataLayerProvider configured with in-memory storage
 */
export async function createTestDataLayer(): Promise<TestDataLayerProvider> {
  const provider = new TestDataLayerProvider();
  await provider.initialize();
  return provider;
}

/**
 * Options for creating a pre-configured test environment.
 */
export interface TestEnvironmentOptions {
  courseId?: string;
  userId?: string;
  userElo?: number;
}

/**
 * Test environment with pre-configured course and user.
 */
export interface TestEnvironment {
  dataLayer: TestDataLayerProvider;
  courseDB: TestCourseDB;
  userDB: TestUserDB;
  courseId: string;
  userId: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a complete test environment with course and user databases.
 */
export async function createTestEnvironment(
  options: TestEnvironmentOptions = {}
): Promise<TestEnvironment> {
  const courseId = options.courseId || `test-course-${Date.now()}`;
  const userId = options.userId || 'test-user';
  const userElo = options.userElo ?? 1200;

  const dataLayer = await createTestDataLayer();
  const courseDB = dataLayer.getCourseDB(courseId);
  const userDB = dataLayer.getUserDB(userId);

  // Set initial user ELO if specified
  userDB.setElo(courseId, userElo);

  return {
    dataLayer,
    courseDB,
    userDB,
    courseId,
    userId,
    cleanup: async () => {
      await dataLayer.teardown();
    },
  };
}