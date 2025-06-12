/**
 * Regression test for chunk routing bug where DISPLAYABLE_DATA documents
 * were incorrectly being searched in CARD chunks due to overlapping ID ranges.
 * 
 * This test specifically validates the fix for the issue where:
 * - Cards would load successfully from CARD chunks
 * - But their referenced displayable data would fail because the system
 *   would look for DISPLAYABLE_DATA docs in CARD chunks instead of DISPLAYABLE_DATA chunks
 * 
 * Bug reported: "Cards are loading but failing to display. DISPLAYABLE_DATA documents 
 * were being searched in CARD chunks!"
 */

import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import { CouchDBToStaticPacker, initializeDataLayer, DataLayerProvider } from '@vue-skuilder/db';
import { DatabaseManager } from '../../setup/database';
import path from 'path';
import fs from 'fs-extra';
import PouchDB from 'pouchdb';

describe('Chunk Routing Regression Tests', () => {
  const courseID = '2aeb8315ef78f3e89ca386992d00825b';
  const COUCH_URL = 'http://localhost:5984';
  let staticProvider: DataLayerProvider;
  let tempOutputDir: string;
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    console.log('🔧 Setting up chunk routing regression test...');
    
    dbManager = new DatabaseManager(COUCH_URL);
    await dbManager.waitForDatabase();
    
    // Create unique temp directory for this test run
    tempOutputDir = path.join(__dirname, `temp-chunk-routing-test-${Date.now()}`);
    
    // Pack course data
    const dbUrl = `http://admin:password@localhost:5984/coursedb-${courseID}`;
    const sourceDB = new PouchDB(dbUrl);
    const packer = new CouchDBToStaticPacker({
      chunkSize: 1000,
      includeAttachments: false,
    });
    
    const packedData = await packer.packCourse(sourceDB, courseID);
    
    // Write packed data to filesystem
    const courseOutputDir = path.join(tempOutputDir, courseID);
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
    
    // Initialize static data layer provider
    staticProvider = await initializeDataLayer({
      type: 'static',
      options: {
        staticContentPath: tempOutputDir,
        manifests: { [courseID]: packedData.manifest },
      },
    });
    
    console.log('✅ Test setup complete');
  });

  afterAll(async () => {
    // Cleanup
    try {
      if (staticProvider) {
        await staticProvider.teardown();
      }
    } catch (error) {
      console.warn('Failed to teardown static provider:', error);
    }
    
    try {
      if (tempOutputDir && await fs.pathExists(tempOutputDir)) {
        await fs.rm(tempOutputDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  it('should load cards and their displayable data without chunk routing errors', async () => {
    console.log('🧪 Testing the specific bug: cards loading but displayable data failing...');
    
    // This test reproduces the exact scenario from the bug report:
    // 1. Load a card (should succeed from CARD chunk)
    // 2. Load its referenced displayable data (should succeed from DISPLAYABLE_DATA chunk)
    // The bug was that step 2 failed because displayable data was searched in CARD chunks
    
    const courseDB = staticProvider.getCourseDB(courseID);
    
    // Get some cards from ELO index (this tests the index loading)
    const cardIds = await courseDB.getCardsByELO(1000, 5);
    expect(cardIds.length).toBeGreaterThan(0);
    
    console.log(`🎯 Testing with ${cardIds.length} cards from ELO query`);
    
    // Test each card and its displayable data
    for (const [index, cardId] of cardIds.slice(0, 3).entries()) { // Test first 3 cards
      console.log(`🔥 Testing card ${index + 1}/${Math.min(3, cardIds.length)}: ${cardId}`);
      
      // Load the card document - this should work fine (comes from CARD chunk)
      const cardDoc = await courseDB.getCourseDoc(cardId);
      expect(cardDoc).toBeDefined();
      expect((cardDoc as any)._id).toBe(cardId);
      console.log(`  ✅ Card document loaded: ${cardId}`);
      
      // Check if this card has displayable data references
      if ((cardDoc as any).id_displayable_data && Array.isArray((cardDoc as any).id_displayable_data) && (cardDoc as any).id_displayable_data.length > 0) {
        console.log(`  📋 Card references ${(cardDoc as any).id_displayable_data.length} displayable data items`);
        
        // Load each displayable data document - this is where the bug would manifest
        for (const [ddIndex, displayableDataId] of (cardDoc as any).id_displayable_data.entries()) {
          console.log(`    📄 Loading displayable data ${ddIndex + 1}: ${displayableDataId}`);
          
          // This is the critical test - before the fix, this would fail with:
          // "Document not found in any chunk" or similar, because the system
          // would look for displayable data in CARD chunks instead of DISPLAYABLE_DATA chunks
          const displayableDoc = await courseDB.getCourseDoc(displayableDataId, {
            attachments: true,
            binary: true,
          });
          
          expect(displayableDoc).toBeDefined();
          expect((displayableDoc as any)._id).toBe(displayableDataId);
          console.log(`    ✅ Displayable data loaded: ${displayableDataId}`);
        }
      } else {
        console.log(`  ℹ️  Card ${cardId} has no displayable data references`);
      }
    }
    
    console.log('🎉 All cards and their displayable data loaded successfully!');
  });

  it('should simulate the StudySession card loading workflow', async () => {
    console.log('🧪 Testing the StudySession.vue workflow that was failing...');
    
    // This test simulates the exact workflow that was failing in StudySession.vue:
    // 1. Load a card document (qualified ID parsing)
    // 2. Load each of its displayable data documents
    // This reproduces the user-facing bug where cards would load but fail to display
    
    const courseDB = staticProvider.getCourseDB(courseID);
    
    // Simulate StudySession.vue's qualified ID format: "courseID-cardID"
    const cardIds = await courseDB.getCardsByELO(1000, 3);
    expect(cardIds.length).toBeGreaterThan(0);
    
    for (const [index, cardID] of cardIds.entries()) {
      console.log(`🎯 Simulating StudySession workflow ${index + 1}/${cardIds.length}`);
      
      // Simulate the parsing in StudySession.vue loadCard() method
      const qualified_id = `${courseID}-${cardID}`;
      const [_courseID, _cardID] = qualified_id.split('-');
      
      console.log(`  📋 Parsed qualified ID: ${qualified_id} -> courseID: ${_courseID}, cardID: ${_cardID}`);
      
      // Step 1: Load the card (as in StudySession.vue line ~554)
      console.log(`  🔥 Loading CARD document: ${_cardID}`);
      const tmpCardData = await courseDB.getCourseDoc(_cardID);
      expect(tmpCardData).toBeDefined();
      expect((tmpCardData as any)._id).toBe(_cardID);
      console.log(`  ✅ Card loaded successfully: ${_cardID}`);
      
      // Step 2: Load displayable data (as in StudySession.vue line ~567-573)
      if ((tmpCardData as any).id_displayable_data && Array.isArray((tmpCardData as any).id_displayable_data)) {
        console.log(`  📋 Card has ${(tmpCardData as any).id_displayable_data.length} displayable data items`);
        
        for (const [ddIndex, displayableDataId] of (tmpCardData as any).id_displayable_data.entries()) {
          console.log(`    🔥 Loading DISPLAYABLE_DATA[${ddIndex}]: ${displayableDataId}`);
          
          // This is exactly where the bug manifested - displayable data loading would fail
          const displayableDoc = await courseDB.getCourseDoc(displayableDataId, {
            attachments: true,
            binary: true,
          });
          
          expect(displayableDoc).toBeDefined();
          expect((displayableDoc as any)._id).toBe(displayableDataId);
          console.log(`    ✅ Displayable data ${ddIndex} loaded successfully: ${displayableDataId}`);
        }
      } else {
        console.log(`  ℹ️  Card ${_cardID} has no displayable data`);
      }
      
      console.log(`  🎉 StudySession workflow ${index + 1} completed successfully!`);
    }
    
    console.log('🎉 All StudySession workflows completed - regression test passed!');
  });
});