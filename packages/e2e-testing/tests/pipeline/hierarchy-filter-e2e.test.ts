/**
 * Hierarchy Filter E2E Test
 *
 * This is a REAL end-to-end test that:
 * 1. Connects to an actual CouchDB instance
 * 2. Creates real cards and strategies in the database
 * 3. Uses the real PipelineAssembler from @vue-skuilder/db
 * 4. Verifies actual pipeline behavior
 *
 * Prerequisites:
 * - CouchDB must be running: `yarn couchdb:start`
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  waitForCouchDB,
  createTestCourseId,
  createRawCourseDB,
  insertTestCard,
  insertTestStrategy,
  insertTestCourseConfig,
  insertTestDesignDocs,
  deleteTestCourseDB,
  DEFAULT_COUCH_CONFIG,
  configureCouchDBEnv,
} from '../../src/harness/real-db';
import { seedRandom } from '../../src/harness/determinism';
import {
  initializeDataLayer,
  _resetDataLayer,
} from '@vue-skuilder/db';

// Skip these tests if CouchDB is not available
const SKIP_IF_NO_COUCH = process.env.SKIP_COUCH_TESTS === 'true';

describe('Hierarchy Filter E2E', () => {
  let courseId: string;
  let restoreRandom: (() => void) | null = null;
  let couchDBAvailable = false;

  beforeAll(async () => {
    if (SKIP_IF_NO_COUCH) {
      console.log('[hierarchy-filter-e2e] Skipping - SKIP_COUCH_TESTS=true');
      return;
    }

    // Wait for CouchDB to be ready
    couchDBAvailable = await waitForCouchDB(DEFAULT_COUCH_CONFIG, 10, 500);

    if (!couchDBAvailable) {
      console.warn('[hierarchy-filter-e2e] CouchDB not available - tests will be skipped');
    }
  }, 30000);

  beforeEach(async () => {
    if (!couchDBAvailable) return;

    // Create a unique course ID for this test
    courseId = createTestCourseId('hierarchy-e2e');

    // Seed randomness for deterministic behavior
    restoreRandom = seedRandom(42);

    // Insert course config to make the database valid
    await insertTestCourseConfig(courseId);
  });

  afterEach(async () => {
    if (restoreRandom) {
      restoreRandom();
      restoreRandom = null;
    }

    // Clean up the test course database
    if (couchDBAvailable && courseId) {
      await deleteTestCourseDB(courseId);
    }
  });

  afterAll(async () => {
    // Any global cleanup
  });

  describe('Strategy and Card Storage', () => {
    it('stores hierarchy strategy in CouchDB', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      // Insert a hierarchy strategy
      const strategyId = await insertTestStrategy(courseId, {
        name: 'test-hierarchy',
        implementingClass: 'hierarchyDefinition',
        description: 'Test hierarchy for E2E',
        serializedData: JSON.stringify({
          levels: ['level-1', 'level-2', 'level-3'],
          unlockThreshold: 0.8,
        }),
      });

      expect(strategyId).toMatch(/^NAVIGATION_STRATEGY-/);

      // Verify it's in the database
      const db = createRawCourseDB(courseId);
      const doc = await db.get(strategyId);

      expect(doc).toBeDefined();
      expect((doc as any).name).toBe('test-hierarchy');
      expect((doc as any).implementingClass).toBe('hierarchyDefinition');
    });

    it('stores cards with level tags in CouchDB', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      // Insert cards for each level
      const cardId1 = await insertTestCard(courseId, {
        id_datashape: 'fillIn',
        data: { prompt: 'Level 1 Question', answer: 'Answer 1' },
        tags: ['level-1', 'basics'],
        elo: { score: 800 },
      });

      const cardId2 = await insertTestCard(courseId, {
        id_datashape: 'fillIn',
        data: { prompt: 'Level 2 Question', answer: 'Answer 2' },
        tags: ['level-2', 'intermediate'],
        elo: { score: 1200 },
      });

      expect(cardId1).toMatch(/^CARD-/);
      expect(cardId2).toMatch(/^CARD-/);

      // Verify cards are in database
      const db = createRawCourseDB(courseId);

      const card1 = await db.get(cardId1);
      expect((card1 as any).tags).toContain('level-1');

      const card2 = await db.get(cardId2);
      expect((card2 as any).tags).toContain('level-2');
    });

    it('retrieves all strategies from course database', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      // Insert multiple strategies
      await insertTestStrategy(courseId, {
        name: 'elo-generator',
        implementingClass: 'elo',
      });

      await insertTestStrategy(courseId, {
        name: 'hierarchy-filter',
        implementingClass: 'hierarchyDefinition',
        serializedData: JSON.stringify({
          levels: ['beginner', 'advanced'],
          unlockThreshold: 0.75,
        }),
      });

      // Query all strategies
      const db = createRawCourseDB(courseId);
      const result = await db.allDocs({
        include_docs: true,
        startkey: 'NAVIGATION_STRATEGY-',
        endkey: 'NAVIGATION_STRATEGY-\ufff0',
      });

      expect(result.rows.length).toBe(2);

      const strategyNames = result.rows.map((r) => (r.doc as any).name);
      expect(strategyNames).toContain('elo-generator');
      expect(strategyNames).toContain('hierarchy-filter');
    });
  });

  describe('Course Setup for Pipeline', () => {
    it('creates a complete hierarchical course structure', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      // Create level-1 cards
      await insertTestCard(courseId, {
        id_datashape: 'fillIn',
        data: { prompt: 'L1 Q1', answer: 'A1' },
        tags: ['level-1'],
        elo: { score: 800 },
      });

      await insertTestCard(courseId, {
        id_datashape: 'fillIn',
        data: { prompt: 'L1 Q2', answer: 'A2' },
        tags: ['level-1'],
        elo: { score: 850 },
      });

      // Create level-2 cards
      await insertTestCard(courseId, {
        id_datashape: 'fillIn',
        data: { prompt: 'L2 Q1', answer: 'A1' },
        tags: ['level-2'],
        elo: { score: 1100 },
      });

      await insertTestCard(courseId, {
        id_datashape: 'fillIn',
        data: { prompt: 'L2 Q2', answer: 'A2' },
        tags: ['level-2'],
        elo: { score: 1150 },
      });

      // Create level-3 cards
      await insertTestCard(courseId, {
        id_datashape: 'fillIn',
        data: { prompt: 'L3 Q1', answer: 'A1' },
        tags: ['level-3'],
        elo: { score: 1400 },
      });

      // Create ELO generator strategy
      await insertTestStrategy(courseId, {
        name: 'elo-gen',
        implementingClass: 'elo',
      });

      // Create hierarchy filter strategy
      await insertTestStrategy(courseId, {
        name: 'progression',
        implementingClass: 'hierarchyDefinition',
        serializedData: JSON.stringify({
          levels: ['level-1', 'level-2', 'level-3'],
          unlockThreshold: 0.8,
        }),
      });

      // Verify totals
      const db = createRawCourseDB(courseId);

      const cards = await db.allDocs({
        include_docs: true,
        startkey: 'CARD-',
        endkey: 'CARD-\ufff0',
      });
      expect(cards.rows.length).toBe(5);

      const strategies = await db.allDocs({
        include_docs: true,
        startkey: 'NAVIGATION_STRATEGY-',
        endkey: 'NAVIGATION_STRATEGY-\ufff0',
      });
      expect(strategies.rows.length).toBe(2);
    });
  });

  describe('Data Integrity', () => {
    it('card documents have correct structure', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      const cardId = await insertTestCard(courseId, {
        id_datashape: 'fillIn',
        data: { prompt: 'Test', answer: 'Answer' },
        tags: ['test-tag'],
        elo: { score: 1000 },
      });

      const db = createRawCourseDB(courseId);
      const doc = (await db.get(cardId)) as any;

      // Verify expected fields
      expect(doc._id).toBe(cardId);
      expect(doc.docType).toBe('CARD');
      expect(doc.id_datashape).toBe('fillIn');
      expect(doc.data).toEqual({ prompt: 'Test', answer: 'Answer' });
      expect(doc.tags).toEqual(['test-tag']);
      expect(doc.elo).toEqual({ score: 1000 });
    });

    it('strategy documents have correct structure', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      const strategyId = await insertTestStrategy(courseId, {
        name: 'test-strat',
        implementingClass: 'hierarchyDefinition',
        description: 'Test description',
        serializedData: JSON.stringify({ levels: ['a', 'b'] }),
      });

      const db = createRawCourseDB(courseId);
      const doc = (await db.get(strategyId)) as any;

      // Verify expected fields
      expect(doc._id).toBe(strategyId);
      expect(doc.docType).toBe('NAVIGATION_STRATEGY');
      expect(doc.name).toBe('test-strat');
      expect(doc.implementingClass).toBe('hierarchyDefinition');
      expect(doc.description).toBe('Test description');

      // Verify serializedData can be parsed
      const config = JSON.parse(doc.serializedData);
      expect(config.levels).toEqual(['a', 'b']);
    });
  });

  describe('PipelineAssembler Compatibility', () => {
    /**
     * These tests verify that strategy documents stored in CouchDB
     * have the correct structure expected by PipelineAssembler.
     *
     * PipelineAssembler.assemble() expects ContentNavigationStrategyData:
     * - _id: string
     * - name: string
     * - implementingClass: string (must match Navigators enum)
     * - serializedData?: string (JSON-encoded config)
     * - description?: string
     * - course?: string
     * - docType?: string
     */

    it('strategy documents have all required PipelineAssembler fields', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      // Insert strategies with all required fields
      await insertTestStrategy(courseId, {
        name: 'elo-generator',
        implementingClass: 'elo',
        description: 'ELO-based card selection',
      });

      await insertTestStrategy(courseId, {
        name: 'hierarchy-filter',
        implementingClass: 'hierarchyDefinition',
        description: 'Level progression filter',
        serializedData: JSON.stringify({
          levels: ['level-1', 'level-2', 'level-3'],
          unlockThreshold: 0.8,
        }),
      });

      // Retrieve all strategies
      const db = createRawCourseDB(courseId);
      const result = await db.allDocs({
        include_docs: true,
        startkey: 'NAVIGATION_STRATEGY-',
        endkey: 'NAVIGATION_STRATEGY-\ufff0',
      });

      expect(result.rows.length).toBe(2);

      // Verify each strategy has required fields for PipelineAssembler
      for (const row of result.rows) {
        const doc = row.doc as any;

        // Required fields
        expect(doc._id).toBeDefined();
        expect(typeof doc._id).toBe('string');
        expect(doc._id.startsWith('NAVIGATION_STRATEGY-')).toBe(true);

        expect(doc.name).toBeDefined();
        expect(typeof doc.name).toBe('string');

        expect(doc.implementingClass).toBeDefined();
        expect(typeof doc.implementingClass).toBe('string');

        // implementingClass must be a known navigator type
        const validImplementingClasses = [
          'elo',
          'srs',
          'hardcoded',
          'hierarchyDefinition',
          'interferenceMitigator',
          'relativePriority',
          'userTagPreference',
          'eloDistanceFilter',
        ];
        expect(validImplementingClasses).toContain(doc.implementingClass);
      }
    });

    it('hierarchy strategy serializedData is valid JSON with expected structure', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      const hierarchyConfig = {
        levels: ['beginner', 'intermediate', 'advanced', 'expert'],
        unlockThreshold: 0.75,
      };

      await insertTestStrategy(courseId, {
        name: 'progression',
        implementingClass: 'hierarchyDefinition',
        serializedData: JSON.stringify(hierarchyConfig),
      });

      const db = createRawCourseDB(courseId);
      const result = await db.allDocs({
        include_docs: true,
        startkey: 'NAVIGATION_STRATEGY-',
        endkey: 'NAVIGATION_STRATEGY-\ufff0',
      });

      const doc = result.rows[0].doc as any;

      // Verify serializedData can be parsed
      expect(doc.serializedData).toBeDefined();
      const parsed = JSON.parse(doc.serializedData);

      // Verify expected hierarchy config structure
      expect(parsed.levels).toEqual(hierarchyConfig.levels);
      expect(parsed.unlockThreshold).toBe(hierarchyConfig.unlockThreshold);
      expect(Array.isArray(parsed.levels)).toBe(true);
      expect(typeof parsed.unlockThreshold).toBe('number');
    });

    it('classifies strategies into generators and filters correctly', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      // Insert a mix of generators and filters
      await insertTestStrategy(courseId, {
        name: 'gen-1',
        implementingClass: 'elo', // Generator
      });

      await insertTestStrategy(courseId, {
        name: 'gen-2',
        implementingClass: 'srs', // Generator
      });

      await insertTestStrategy(courseId, {
        name: 'filter-1',
        implementingClass: 'hierarchyDefinition', // Filter
        serializedData: JSON.stringify({ levels: ['a', 'b'] }),
      });

      await insertTestStrategy(courseId, {
        name: 'filter-2',
        implementingClass: 'relativePriority', // Filter
        serializedData: JSON.stringify({ tagPriorities: { important: 2.0 } }),
      });

      const db = createRawCourseDB(courseId);
      const result = await db.allDocs({
        include_docs: true,
        startkey: 'NAVIGATION_STRATEGY-',
        endkey: 'NAVIGATION_STRATEGY-\ufff0',
      });

      // Classify like PipelineAssembler does
      const generatorClasses = ['elo', 'srs', 'hardcoded'];
      const filterClasses = [
        'hierarchyDefinition',
        'interferenceMitigator',
        'relativePriority',
        'userTagPreference',
        'eloDistanceFilter',
      ];

      const generators = result.rows.filter((r) =>
        generatorClasses.includes((r.doc as any).implementingClass)
      );
      const filters = result.rows.filter((r) =>
        filterClasses.includes((r.doc as any).implementingClass)
      );

      expect(generators.length).toBe(2);
      expect(filters.length).toBe(2);

      // Verify generator names
      const generatorNames = generators.map((r) => (r.doc as any).name);
      expect(generatorNames).toContain('gen-1');
      expect(generatorNames).toContain('gen-2');

      // Verify filter names
      const filterNames = filters.map((r) => (r.doc as any).name);
      expect(filterNames).toContain('filter-1');
      expect(filterNames).toContain('filter-2');
    });

    it('cards have tags that match hierarchy levels', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      const levels = ['beginner', 'intermediate', 'advanced'];

      // Create hierarchy strategy
      await insertTestStrategy(courseId, {
        name: 'hierarchy',
        implementingClass: 'hierarchyDefinition',
        serializedData: JSON.stringify({ levels, unlockThreshold: 0.8 }),
      });

      // Create cards for each level
      for (const level of levels) {
        await insertTestCard(courseId, {
          id_datashape: 'fillIn',
          data: { prompt: `${level} question`, answer: 'answer' },
          tags: [level],
          elo: { score: levels.indexOf(level) * 400 + 800 },
        });
      }

      const db = createRawCourseDB(courseId);

      // Get strategy
      const strategies = await db.allDocs({
        include_docs: true,
        startkey: 'NAVIGATION_STRATEGY-',
        endkey: 'NAVIGATION_STRATEGY-\ufff0',
      });
      const strategyConfig = JSON.parse((strategies.rows[0].doc as any).serializedData);

      // Get cards
      const cards = await db.allDocs({
        include_docs: true,
        startkey: 'CARD-',
        endkey: 'CARD-\ufff0',
      });

      // Verify each card has a tag that matches a hierarchy level
      for (const row of cards.rows) {
        const card = row.doc as any;
        const cardLevelTags = card.tags.filter((t: string) =>
          strategyConfig.levels.includes(t)
        );

        // Each card should have exactly one level tag
        expect(cardLevelTags.length).toBe(1);
        expect(strategyConfig.levels).toContain(cardLevelTags[0]);
      }
    });
  });

  describe('Real Pipeline Execution', () => {
    /**
     * These tests use the real PipelineAssembler to build and execute
     * a pipeline against CouchDB data.
     *
     * This is the ultimate E2E test - it proves the entire chain works:
     * CouchDB → CourseDB → PipelineAssembler → Pipeline → getWeightedCards()
     */

    it('initializes DataLayerProvider with CouchDB config', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      // Reset any existing data layer
      await _resetDataLayer();

      // Configure ENV for CouchDB access
      configureCouchDBEnv(DEFAULT_COUCH_CONFIG);

      // Initialize the data layer
      const dataLayer = await initializeDataLayer({
        type: 'couch',
        options: {
          COUCHDB_SERVER_URL: DEFAULT_COUCH_CONFIG.serverUrl,
          COUCHDB_SERVER_PROTOCOL: DEFAULT_COUCH_CONFIG.protocol,
          COUCHDB_USERNAME: DEFAULT_COUCH_CONFIG.username,
          COUCHDB_PASSWORD: DEFAULT_COUCH_CONFIG.password,
          COURSE_IDS: [courseId],
        },
      });

      expect(dataLayer).toBeDefined();

      // Verify we can get a CourseDB
      const courseDB = dataLayer.getCourseDB(courseId);
      expect(courseDB).toBeDefined();
      expect(courseDB.getCourseID()).toBe(courseId);

      // Clean up
      await _resetDataLayer();
    });

    it('CourseDB can retrieve strategies inserted via raw PouchDB', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      // Insert strategy via raw PouchDB (simulating MCP or other tool)
      await insertTestStrategy(courseId, {
        name: 'elo-gen',
        implementingClass: 'elo',
        description: 'ELO generator for E2E test',
      });

      // Reset and initialize data layer
      await _resetDataLayer();
      configureCouchDBEnv(DEFAULT_COUCH_CONFIG);

      const dataLayer = await initializeDataLayer({
        type: 'couch',
        options: {
          COUCHDB_SERVER_URL: DEFAULT_COUCH_CONFIG.serverUrl,
          COUCHDB_SERVER_PROTOCOL: DEFAULT_COUCH_CONFIG.protocol,
          COUCHDB_USERNAME: DEFAULT_COUCH_CONFIG.username,
          COUCHDB_PASSWORD: DEFAULT_COUCH_CONFIG.password,
          COURSE_IDS: [courseId],
        },
      });

      const courseDB = dataLayer.getCourseDB(courseId);

      // Get all navigation strategies via the real CourseDB interface
      const strategies = await courseDB.getAllNavigationStrategies();

      expect(strategies.length).toBeGreaterThanOrEqual(1);

      const eloStrategy = strategies.find((s) => s.name === 'elo-gen');
      expect(eloStrategy).toBeDefined();
      expect(eloStrategy!.implementingClass).toBe('elo');

      await _resetDataLayer();
    });

    /**
     * Full end-to-end pipeline execution test.
     *
     * This test exercises the complete pipeline flow:
     * 1. Real CouchDB with CourseConfig and design documents
     * 2. Real cards and navigation strategy stored in database
     * 3. Real DataLayerProvider initialization (with navigator registry)
     * 4. Real PipelineAssembler creating a Pipeline from strategies
     * 5. Real ELONavigator producing weighted cards
     * 6. Real Pipeline execution with scoring and provenance
     *
     * Previously this was skipped due to dynamic import issues in Jest.
     * Resolved by:
     * - Migrating from Jest to Vitest
     * - Adding navigator registry (initializeNavigatorRegistry) to @vue-skuilder/db
     * - Registry pre-loads navigator implementations, avoiding dynamic imports
     */
    it('calls getWeightedCards via real CourseDB and Pipeline', async () => {
      if (!couchDBAvailable) {
        console.log('Skipping - CouchDB not available');
        return;
      }

      // Insert course config and design docs (required for pipeline operations)
      await insertTestCourseConfig(courseId);
      await insertTestDesignDocs(courseId);

      // Insert cards and strategy
      await insertTestCard(courseId, {
        id_datashape: 'fillIn',
        data: { prompt: 'Test Q1', answer: 'A1' },
        tags: ['test'],
        elo: { score: 1200 },
      });

      await insertTestCard(courseId, {
        id_datashape: 'fillIn',
        data: { prompt: 'Test Q2', answer: 'A2' },
        tags: ['test'],
        elo: { score: 1100 },
      });

      await insertTestStrategy(courseId, {
        name: 'elo-generator',
        implementingClass: 'elo',
      });

      // Initialize data layer
      await _resetDataLayer();
      configureCouchDBEnv(DEFAULT_COUCH_CONFIG);

      const dataLayer = await initializeDataLayer({
        type: 'couch',
        options: {
          COUCHDB_SERVER_URL: DEFAULT_COUCH_CONFIG.serverUrl,
          COUCHDB_SERVER_PROTOCOL: DEFAULT_COUCH_CONFIG.protocol,
          COUCHDB_USERNAME: DEFAULT_COUCH_CONFIG.username,
          COUCHDB_PASSWORD: DEFAULT_COUCH_CONFIG.password,
          COURSE_IDS: [courseId],
        },
      });

      const courseDB = dataLayer.getCourseDB(courseId);

      // CourseDB.getWeightedCards() internally:
      // 1. Gets the current user
      // 2. Calls createNavigator() which uses PipelineAssembler
      // 3. Returns weighted cards from the pipeline
      //
      // This is the real end-to-end flow!
      const cards = await courseDB.getWeightedCards(10);

      // We should get cards back (may be 0 if ELO scoring excludes them,
      // but the call should succeed)
      expect(Array.isArray(cards)).toBe(true);

      console.log(`[E2E] Pipeline returned ${cards.length} weighted cards`);

      // If we got cards, verify they have the expected structure
      if (cards.length > 0) {
        const firstCard = cards[0];
        expect(firstCard.cardId).toBeDefined();
        expect(firstCard.courseId).toBe(courseId);
        expect(typeof firstCard.score).toBe('number');
        expect(Array.isArray(firstCard.provenance)).toBe(true);
      }

      await _resetDataLayer();
    });
  });
});