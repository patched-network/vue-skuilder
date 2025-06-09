// packages/db/src/impl/static/packer/index.ts

import { logger } from '../../../util/logger';
import { CardData, DocType, SkuilderCourseData, Tag } from '../../../core/types/types-legacy';
import { CourseConfig, CourseElo } from '@vue-skuilder/common';

export interface StaticCourseManifest {
  version: string;
  courseId: string;
  courseName: string;
  lastUpdated: string;
  documentCount: number;
  chunks: ChunkMetadata[];
  indices: IndexMetadata[];
  designDocs: DesignDocument[];
}

export interface ChunkMetadata {
  id: string;
  docType: DocType;
  startKey: string;
  endKey: string;
  documentCount: number;
  sizeBytes: number;
  path: string;
}

export interface IndexMetadata {
  name: string;
  type: 'btree' | 'hash' | 'spatial';
  path: string;
  sizeBytes: number;
}

export interface DesignDocument {
  _id: string;
  views: {
    [viewName: string]: {
      map: string;
      reduce?: string;
    };
  };
}

export interface PackerConfig {
  chunkSize: number; // Number of documents per chunk
  outputDir: string;
  includeAttachments: boolean;
  compressionLevel?: number;
}

export class CouchDBToStaticPacker {
  private config: PackerConfig;
  private indexData: Map<string, any> = new Map();

  constructor(config: PackerConfig) {
    this.config = {
      chunkSize: 1000,
      compressionLevel: 6,
      includeAttachments: true,
      ...config,
    };
  }

  /**
   * Pack a CouchDB course database into static files
   */
  async packCourse(sourceDB: PouchDB.Database, courseId: string): Promise<StaticCourseManifest> {
    logger.info(`Starting static pack for course: ${courseId}`);

    const manifest: StaticCourseManifest = {
      version: '1.0.0',
      courseId,
      courseName: '',
      lastUpdated: new Date().toISOString(),
      documentCount: 0,
      chunks: [],
      indices: [],
      designDocs: [],
    };

    // 1. Extract course config
    const courseConfig = await this.extractCourseConfig(sourceDB);
    manifest.courseName = courseConfig.name;

    // 2. Extract and process design documents
    manifest.designDocs = await this.extractDesignDocs(sourceDB);

    // 3. Extract all documents by type and create chunks
    const docsByType = await this.extractDocumentsByType(sourceDB);

    // 4. Create chunks
    for (const [docType, docs] of Object.entries(docsByType)) {
      const chunks = this.createChunks(docs, docType as DocType);
      manifest.chunks.push(...chunks);
      manifest.documentCount += docs.length;
    }

    // 5. Build indices based on design documents
    manifest.indices = await this.buildIndices(docsByType, manifest.designDocs);

    // 6. Write all files
    await this.writeManifest(manifest);
    await this.writeChunks(manifest.chunks, docsByType);
    await this.writeIndices(manifest.indices);

    return manifest;
  }

  private async extractCourseConfig(db: PouchDB.Database): Promise<CourseConfig> {
    try {
      return await db.get<CourseConfig>('CourseConfig');
    } catch (error) {
      logger.error('Failed to extract course config:', error);
      throw new Error('Course config not found');
    }
  }

  private async extractDesignDocs(db: PouchDB.Database): Promise<DesignDocument[]> {
    const result = await db.allDocs({
      startkey: '_design/',
      endkey: '_design/\ufff0',
      include_docs: true,
    });

    return result.rows.map((row) => ({
      _id: row.id,
      views: (row.doc as any).views || {},
    }));
  }

  private async extractDocumentsByType(db: PouchDB.Database): Promise<Record<DocType, any[]>> {
    const allDocs = await db.allDocs({ include_docs: true });
    const docsByType: Record<string, any[]> = {};

    for (const row of allDocs.rows) {
      if (row.id.startsWith('_')) continue; // Skip design docs

      const doc = row.doc as SkuilderCourseData;
      if (doc.docType) {
        if (!docsByType[doc.docType]) {
          docsByType[doc.docType] = [];
        }
        docsByType[doc.docType].push(doc);
      }
    }

    return docsByType as Record<DocType, any[]>;
  }

  private createChunks(docs: any[], docType: DocType): ChunkMetadata[] {
    const chunks: ChunkMetadata[] = [];
    const sortedDocs = docs.sort((a, b) => a._id.localeCompare(b._id));

    for (let i = 0; i < sortedDocs.length; i += this.config.chunkSize) {
      const chunk = sortedDocs.slice(i, i + this.config.chunkSize);
      const chunkId = `${docType}-${String(Math.floor(i / this.config.chunkSize)).padStart(4, '0')}`;

      chunks.push({
        id: chunkId,
        docType,
        startKey: chunk[0]._id,
        endKey: chunk[chunk.length - 1]._id,
        documentCount: chunk.length,
        sizeBytes: 0, // Will be updated when written
        path: `chunks/${chunkId}.json`,
      });
    }

    return chunks;
  }

  private async buildIndices(
    docsByType: Record<DocType, any[]>,
    designDocs: DesignDocument[]
  ): Promise<IndexMetadata[]> {
    const indices: IndexMetadata[] = [];

    // Build ELO index
    if (docsByType[DocType.CARD]) {
      const eloIndex = await this.buildEloIndex(docsByType[DocType.CARD] as CardData[]);
      indices.push(eloIndex);
    }

    // Build tag indices
    if (docsByType[DocType.TAG]) {
      const tagIndex = await this.buildTagIndex(docsByType[DocType.TAG] as Tag[]);
      indices.push(tagIndex);
    }

    // Build indices from design documents
    for (const designDoc of designDocs) {
      for (const [viewName, viewDef] of Object.entries(designDoc.views)) {
        if (viewDef.map) {
          const index = await this.buildViewIndex(
            viewName,
            viewDef.map,
            docsByType,
            viewDef.reduce
          );
          if (index) indices.push(index);
        }
      }
    }

    return indices;
  }

  private async buildEloIndex(cards: CardData[]): Promise<IndexMetadata> {
    // Build a B-tree like structure for ELO queries
    const eloIndex: Array<{ elo: number; cardId: string }> = [];

    for (const card of cards) {
      if (card.elo?.global?.score) {
        eloIndex.push({
          elo: card.elo.global.score,
          cardId: card._id,
        });
      }
    }

    // Sort by ELO for efficient range queries
    eloIndex.sort((a, b) => a.elo - b.elo);

    // Create buckets for faster lookup
    const buckets: Record<number, string[]> = {};
    const bucketSize = 50; // ELO points per bucket

    for (const entry of eloIndex) {
      const bucket = Math.floor(entry.elo / bucketSize) * bucketSize;
      if (!buckets[bucket]) buckets[bucket] = [];
      buckets[bucket].push(entry.cardId);
    }

    // Store the index data for later writing
    this.indexData.set('elo', {
      sorted: eloIndex,
      buckets: buckets,
      stats: {
        min: eloIndex[0]?.elo || 0,
        max: eloIndex[eloIndex.length - 1]?.elo || 0,
        count: eloIndex.length,
      },
    });

    return {
      name: 'elo',
      type: 'btree',
      path: 'indices/elo.json',
      sizeBytes: 0, // Updated when written
    };
  }

  private async buildTagIndex(tags: Tag[]): Promise<IndexMetadata> {
    // Build inverted index for tags
    const tagIndex: Record<
      string,
      {
        cardIds: string[];
        snippet: string;
        count: number;
      }
    > = {};

    for (const tag of tags) {
      tagIndex[tag.name] = {
        cardIds: tag.taggedCards,
        snippet: tag.snippet,
        count: tag.taggedCards.length,
      };
    }

    // Also build a reverse index (card -> tags)
    const cardToTags: Record<string, string[]> = {};
    for (const tag of tags) {
      for (const cardId of tag.taggedCards) {
        if (!cardToTags[cardId]) cardToTags[cardId] = [];
        cardToTags[cardId].push(tag.name);
      }
    }

    this.indexData.set('tags', {
      byTag: tagIndex,
      byCard: cardToTags,
    });

    return {
      name: 'tags',
      type: 'hash',
      path: 'indices/tags.json',
      sizeBytes: 0,
    };
  }

  private async buildViewIndex(
    viewName: string,
    mapFunction: string,
    docsByType: Record<DocType, any[]>,
    reduceFunction?: string
  ): Promise<IndexMetadata | null> {
    try {
      // Parse and execute the map function in a sandboxed way
      // This is a simplified version - in production you'd want proper sandboxing
      const viewResults: Array<{ key: any; value: any; id: string }> = [];

      // Create a safe emit function
      const emit = (key: any, value: any) => {
        viewResults.push({ key, value, id: currentDocId });
      };

      let currentDocId = '';

      // Create the map function
      // Note: This is simplified and would need proper sandboxing in production
      const mapFn = new Function('doc', 'emit', mapFunction);

      // Run map function on all documents
      for (const docs of Object.values(docsByType)) {
        for (const doc of docs) {
          currentDocId = doc._id;
          try {
            mapFn(doc, emit);
          } catch (error) {
            logger.warn(`Map function error for doc ${doc._id}:`, error);
          }
        }
      }

      // Sort by key for efficient querying
      viewResults.sort((a, b) => {
        if (a.key < b.key) return -1;
        if (a.key > b.key) return 1;
        return 0;
      });

      return {
        name: `view-${viewName}`,
        type: 'btree',
        path: `indices/view-${viewName}.json`,
        sizeBytes: 0,
      };
    } catch (error) {
      logger.error(`Failed to build index for view ${viewName}:`, error);
      return null;
    }
  }

  // File writing methods - Full implementation
  private async writeManifest(manifest: StaticCourseManifest): Promise<void> {
    logger.info('Writing manifest...');
    const fs = await import('fs-extra');
    const path = await import('path');

    const manifestPath = path.join(this.config.outputDir, 'manifest.json');
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  }

  private async writeChunks(
    chunks: ChunkMetadata[],
    docsByType: Record<DocType, any[]>
  ): Promise<void> {
    logger.info(`Writing ${chunks.length} chunks...`);
    const fs = await import('fs-extra');
    const path = await import('path');
    const zlib = await import('zlib');
    const { promisify } = await import('util');
    const gzip = promisify(zlib.gzip);

    const chunksDir = path.join(this.config.outputDir, 'chunks');
    await fs.ensureDir(chunksDir);

    // Group documents by chunk
    const docsByChunk = new Map<string, any[]>();

    for (const chunk of chunks) {
      const docs = docsByType[chunk.docType] || [];
      const chunkDocs = docs.filter((doc) => doc._id >= chunk.startKey && doc._id <= chunk.endKey);
      docsByChunk.set(chunk.id, chunkDocs);
    }

    // Write each chunk
    for (const chunk of chunks) {
      const chunkPath = path.join(this.config.outputDir, chunk.path);
      const docs = docsByChunk.get(chunk.id) || [];

      // Remove unnecessary fields to reduce size
      const cleanedDocs = docs.map((doc) => {
        const cleaned = { ...doc };
        delete cleaned._rev; // Remove revision info
        if (!this.config.includeAttachments) {
          delete cleaned._attachments;
        }
        return cleaned;
      });

      const jsonData = JSON.stringify(cleanedDocs);

      // Optionally compress
      if (this.config.compressionLevel && this.config.compressionLevel > 0) {
        const compressed = await gzip(jsonData, {
          level: this.config.compressionLevel,
        });
        await fs.writeFile(chunkPath + '.gz', compressed);
        chunk.sizeBytes = compressed.length;
        chunk.path += '.gz';
      } else {
        await fs.writeFile(chunkPath, jsonData);
        chunk.sizeBytes = Buffer.byteLength(jsonData);
      }
    }
  }

  private async writeIndices(indices: IndexMetadata[]): Promise<void> {
    logger.info(`Writing ${indices.length} indices...`);
    const fs = await import('fs-extra');
    const path = await import('path');

    const indicesDir = path.join(this.config.outputDir, 'indices');
    await fs.ensureDir(indicesDir);

    // Write each index with its data
    for (const index of indices) {
      const indexPath = path.join(this.config.outputDir, index.path);
      const indexData = this.indexData.get(index.name);

      if (indexData) {
        const jsonData = JSON.stringify(indexData, null, 2);
        await fs.writeFile(indexPath, jsonData);
        index.sizeBytes = Buffer.byteLength(jsonData);
      } else {
        logger.warn(`No data found for index: ${index.name}`);
      }
    }
  }
}

// Unpacker for reading static data back
export class StaticDataUnpacker {
  private manifest: StaticCourseManifest;
  private baseUrl: string;
  private cache: Map<string, any> = new Map();

  constructor(manifest: StaticCourseManifest, baseUrl: string) {
    this.manifest = manifest;
    this.baseUrl = baseUrl;
  }

  async getDocument(docId: string): Promise<any> {
    // Check cache first
    if (this.cache.has(docId)) {
      return this.cache.get(docId);
    }

    // Find which chunk contains this document
    for (const chunk of this.manifest.chunks) {
      if (docId >= chunk.startKey && docId <= chunk.endKey) {
        const chunkData = await this.loadChunk(chunk);
        const doc = chunkData.find((d: any) => d._id === docId);
        if (doc) {
          this.cache.set(docId, doc);
          return doc;
        }
      }
    }

    throw new Error(`Document ${docId} not found`);
  }

  async queryByElo(targetElo: number, limit: number): Promise<string[]> {
    const eloIndex = await this.loadIndex('elo');

    // Use binary search to find cards closest to targetElo
    const sorted = eloIndex.sorted as Array<{ elo: number; cardId: string }>;

    // Binary search for insertion point
    let left = 0;
    let right = sorted.length - 1;
    let mid = 0;

    while (left <= right) {
      mid = Math.floor((left + right) / 2);
      if (sorted[mid].elo < targetElo) {
        left = mid + 1;
      } else if (sorted[mid].elo > targetElo) {
        right = mid - 1;
      } else {
        break;
      }
    }

    // Collect cards around the target ELO
    const results: Array<{ elo: number; cardId: string }> = [];
    let leftIdx = mid;
    let rightIdx = mid + 1;

    while (results.length < limit && (leftIdx >= 0 || rightIdx < sorted.length)) {
      const leftDiff = leftIdx >= 0 ? Math.abs(sorted[leftIdx].elo - targetElo) : Infinity;
      const rightDiff =
        rightIdx < sorted.length ? Math.abs(sorted[rightIdx].elo - targetElo) : Infinity;

      if (leftDiff <= rightDiff) {
        results.push(sorted[leftIdx]);
        leftIdx--;
      } else {
        results.push(sorted[rightIdx]);
        rightIdx++;
      }
    }

    // Sort by distance from target ELO, then randomize equal distances
    results.sort((a, b) => {
      const diffA = Math.abs(a.elo - targetElo);
      const diffB = Math.abs(b.elo - targetElo);
      if (diffA === diffB) {
        return Math.random() - 0.5;
      }
      return diffA - diffB;
    });

    return results.slice(0, limit).map((r) => r.cardId);
  }

  async queryByTag(tagName: string): Promise<string[]> {
    const tagIndex = await this.loadIndex('tags');
    return tagIndex.byTag[tagName]?.cardIds || [];
  }

  async getTagsForCard(cardId: string): Promise<string[]> {
    const tagIndex = await this.loadIndex('tags');
    return tagIndex.byCard[cardId] || [];
  }

  private async loadChunk(chunk: ChunkMetadata): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/${chunk.path}`);
    return response.json();
  }

  private async loadIndex(indexName: string): Promise<any> {
    const indexMeta = this.manifest.indices.find((i) => i.name === indexName);
    if (!indexMeta) throw new Error(`Index ${indexName} not found`);

    const response = await fetch(`${this.baseUrl}/${indexMeta.path}`);
    return response.json();
  }
}
