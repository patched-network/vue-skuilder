// packages/e2e-db/src/tests/static-data-layer/static-data-layer-smoke.test.ts

import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import path from 'path';
import fs from 'fs-extra';
import PouchDB from 'pouchdb';
import { initializeDataLayer, DataLayerProvider } from '@vue-skuilder/db';
import { CouchDBToStaticPacker, StaticCourseManifest } from '@vue-skuilder/db';
import { DatabaseManager } from '../../setup/database';

const COUCH_URL = 'http://localhost:5984';
const TEST_COURSE_ID = '2aeb8315ef78f3e89ca386992d00825b';

describe('Static Data Layer Smoke Test', () => {
  let dbManager: DatabaseManager;
  let tempOutputDir: string;
  let staticProvider: DataLayerProvider | null = null;

  beforeAll(async () => {
    dbManager = new DatabaseManager(COUCH_URL);
    await dbManager.waitForDatabase();

    // Create unique temp directory for this test run
    tempOutputDir = path.join(__dirname, `temp-static-test-${Date.now()}`);
  });

  afterAll(async () => {
    // Cleanup: Remove temp directory and teardown provider
    try {
      if (staticProvider) {
        await staticProvider.teardown();
      }
    } catch (error) {
      console.warn('Failed to teardown static provider:', error);
    }

    try {
      await fs.rm(tempOutputDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  it('should pack course data, initialize static provider, and perform basic operations', async () => {
    // Phase 1: Pack Course Data
    console.log(`📦 Packing course ${TEST_COURSE_ID}...`);

    const dbUrl = `http://admin:password@localhost:5984/coursedb-${TEST_COURSE_ID}`;
    const sourceDB = new PouchDB(dbUrl);

    // Test database connection first
    const dbInfo = await sourceDB.info();
    expect(dbInfo.doc_count).toBeGreaterThan(0);
    console.log(`✅ Connected to course database with ${dbInfo.doc_count} documents`);

    const packer = new CouchDBToStaticPacker({
      chunkSize: 1000,
      includeAttachments: false,
    });

    const packedData = await packer.packCourse(sourceDB, TEST_COURSE_ID);
    expect(packedData).toBeDefined();
    expect(packedData.manifest).toBeDefined();
    expect(packedData.chunks.size).toBeGreaterThan(0);
    expect(packedData.indices.size).toBeGreaterThan(0);

    console.log(
      `✅ Packed course: ${packedData.manifest.documentCount} docs, ${packedData.chunks.size} chunks, ${packedData.indices.size} indices`
    );

    // Write packed data to filesystem
    const courseOutputDir = path.join(tempOutputDir, TEST_COURSE_ID);
    await fs.ensureDir(courseOutputDir);

    // Write manifest
    await fs.writeFile(
      path.join(courseOutputDir, 'manifest.json'),
      JSON.stringify(packedData.manifest, null, 2)
    );

    // Write chunks
    const chunksDir = path.join(courseOutputDir, 'chunks');
    await fs.ensureDir(chunksDir);
    for (const [chunkId, documents] of packedData.chunks) {
      const chunkPath = path.join(chunksDir, `${chunkId}.json`);
      await fs.writeFile(chunkPath, JSON.stringify(documents, null, 2));
    }

    // Write indices
    const indicesDir = path.join(courseOutputDir, 'indices');
    await fs.ensureDir(indicesDir);
    for (const [indexName, indexData] of packedData.indices) {
      const indexPath = path.join(indicesDir, `${indexName}.json`);
      await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
    }

    // Phase 2: Validate Packed Output
    console.log('🔍 Validating packed output...');

    expect(await fs.pathExists(path.join(courseOutputDir, 'manifest.json'))).toBe(true);
    expect(await fs.pathExists(chunksDir)).toBe(true);
    expect(await fs.pathExists(indicesDir)).toBe(true);

    // Load and validate manifest
    const manifestContent = await fs.readFile(path.join(courseOutputDir, 'manifest.json'), 'utf8');
    const manifest: StaticCourseManifest = JSON.parse(manifestContent);
    expect(manifest.courseId).toBe(TEST_COURSE_ID);
    expect(manifest.chunks.length).toBeGreaterThan(0);
    expect(manifest.indices.length).toBeGreaterThan(0);
    expect(manifest.documentCount).toBeGreaterThan(0);

    console.log(
      `✅ Manifest valid: ${manifest.chunks.length} chunks, ${manifest.indices.length} indices`
    );

    // Phase 3: Initialize Static Data Layer
    console.log('🔧 Initializing static data layer...');

    staticProvider = await initializeDataLayer({
      type: 'static',
      options: {
        staticContentPath: tempOutputDir,
        manifests: { [TEST_COURSE_ID]: manifest },
      },
    });

    expect(staticProvider).toBeDefined();
    console.log('✅ Static data layer initialized');

    // Get course database
    const staticCourseDB = staticProvider.getCourseDB(TEST_COURSE_ID);
    expect(staticCourseDB).toBeDefined();
    expect(staticCourseDB.getCourseID()).toBe(TEST_COURSE_ID);

    // Phase 4: Basic Smoke Tests
    console.log('🧪 Running smoke tests...');

    // Test course config loading
    const courseConfig = await staticCourseDB.getCourseConfig();
    expect(courseConfig).toBeDefined();
    console.log(`✅ Course config loaded: ${JSON.stringify(courseConfig) || 'unnamed course'}`);

    // Test getting new cards
    const newCards = await staticCourseDB.getNewCards(5);
    expect(Array.isArray(newCards)).toBe(true);
    expect(newCards.length).toBeGreaterThan(0);
    expect(newCards.length).toBeLessThanOrEqual(5);

    // Validate card structure
    const firstCard = newCards[0];
    expect(firstCard.cardID).toBeDefined();
    expect(firstCard.courseID).toBe(TEST_COURSE_ID);
    expect(firstCard.status).toBe('new');

    console.log(`✅ Got ${newCards.length} new cards`);

    // Test ELO-based card queries
    const cardsByElo = await staticCourseDB.getCardsByELO(1000, 3);
    expect(Array.isArray(cardsByElo)).toBe(true);
    expect(cardsByElo.length).toBeGreaterThan(0);
    expect(cardsByElo.length).toBeLessThanOrEqual(3);

    console.log(`✅ Got ${cardsByElo.length} cards by ELO`);

    // Test document loading with real card ID
    const cardDoc = await staticCourseDB.getCourseDoc(firstCard.cardID);
    expect(cardDoc).toBeDefined();
    expect((cardDoc as any)._id).toBe(firstCard.cardID);

    console.log(`✅ Loaded card document: ${(cardDoc as any)._id}`);

    // Test ELO index functionality with different scores
    const eloCards950 = await staticCourseDB.getCardsByELO(950, 2);
    expect(Array.isArray(eloCards950)).toBe(true);

    const eloCards1050 = await staticCourseDB.getCardsByELO(1050, 2);
    expect(Array.isArray(eloCards1050)).toBe(true);

    console.log(
      `✅ ELO queries work: ${eloCards950.length} cards at 950, ${eloCards1050.length} cards at 1050`
    );

    // Test user DB integration
    const userDB = staticProvider.getUserDB();
    expect(userDB).toBeDefined();
    expect(userDB.isLoggedIn()).toBe(false); // Should be guest mode
    expect(userDB.getUsername()).toBe('Guest');

    console.log('✅ User DB integration works (guest mode)');

    // Test courses DB
    const coursesDB = staticProvider.getCoursesDB();
    expect(coursesDB).toBeDefined();

    const courseList = await coursesDB.getCourseList();
    expect(Array.isArray(courseList)).toBe(true);
    expect(courseList.length).toBeGreaterThan(0);

    console.log(`✅ Courses DB works: ${courseList.length} available courses`);

    console.log('🎉 All smoke tests passed!');
  }, 60000); // 60 second timeout for this comprehensive test
});
