// packages/db/src/impl/static/StaticDataUnpacker.ts

import { StaticCourseManifest, ChunkMetadata } from '../../util/packer/types';
import { logger } from '../../util/logger';
import { DocType } from '../../core/types/types-legacy';

interface EloIndexEntry {
  elo: number;
  cardId: string;
}

interface EloIndex {
  sorted: EloIndexEntry[];
  buckets: Record<string, EloIndexEntry[]>;
  stats: {
    min: number;
    max: number;
    count: number;
  };
}

interface TagsIndex {
  byTag: Record<string, string[]>; // tagName -> cardIds
  byCard: Record<string, string[]>; // cardId -> tagNames
}

export class StaticDataUnpacker {
  private manifest: StaticCourseManifest;
  private basePath: string;
  private documentCache: Map<string, any> = new Map();
  private chunkCache: Map<string, any[]> = new Map();
  private indexCache: Map<string, any> = new Map();

  constructor(manifest: StaticCourseManifest, basePath: string) {
    this.manifest = manifest;
    this.basePath = basePath;
  }

  /**
   * Get a document by ID, loading from appropriate chunk if needed
   */
  async getDocument<T = any>(id: string): Promise<T> {
    // Check document cache first
    if (this.documentCache.has(id)) {
      return this.documentCache.get(id);
    }

    // Find which chunk contains this document
    const chunk = this.findChunkForDocument(id);
    if (!chunk) {
      throw new Error(`Document ${id} not found in any chunk`);
    }

    // Load the chunk if not cached
    await this.loadChunk(chunk.id);

    // Try to get the document from cache again
    if (this.documentCache.has(id)) {
      return this.documentCache.get(id);
    }

    throw new Error(`Document ${id} not found in chunk ${chunk.id}`);
  }

  /**
   * Query cards by ELO score, returning card IDs sorted by ELO
   */
  async queryByElo(targetElo: number, limit: number = 25): Promise<string[]> {
    const eloIndex = await this.loadIndex('elo') as EloIndex;
    
    if (!eloIndex || !eloIndex.sorted) {
      logger.warn('ELO index not found or malformed, returning empty results');
      return [];
    }

    // Find cards near the target ELO
    const sorted = eloIndex.sorted;
    let startIndex = 0;

    // Binary search to find insertion point for target ELO
    let left = 0;
    let right = sorted.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (sorted[mid].elo < targetElo) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    startIndex = left;

    // Collect cards around the target ELO
    const result: string[] = [];
    const halfLimit = Math.floor(limit / 2);
    
    // Get cards below target ELO
    for (let i = Math.max(0, startIndex - halfLimit); i < startIndex && result.length < limit; i++) {
      result.push(sorted[i].cardId);
    }
    
    // Get cards at or above target ELO
    for (let i = startIndex; i < sorted.length && result.length < limit; i++) {
      result.push(sorted[i].cardId);
    }

    return result;
  }

  /**
   * Get all tag names mapped to their card arrays
   */
  async getTagsIndex(): Promise<TagsIndex> {
    return await this.loadIndex('tags') as TagsIndex;
  }

  /**
   * Find which chunk contains a specific document ID
   */
  private findChunkForDocument(docId: string): ChunkMetadata | undefined {
    // Determine document type from ID prefix
    let docType: DocType;
    
    if (docId.startsWith('card-')) {
      docType = DocType.CARD;
    } else if (docId.startsWith('tag-')) {
      docType = DocType.TAG;
    } else if (docId.includes('displayable_data')) {
      docType = DocType.DISPLAYABLE_DATA;
    } else {
      // Try to find by checking document type in chunk metadata
      // For now, assume it's in the first chunk of each type
      for (const chunk of this.manifest.chunks) {
        if (docId >= chunk.startKey && docId <= chunk.endKey) {
          return chunk;
        }
      }
      return undefined;
    }

    // Find the chunk for this document type
    return this.manifest.chunks.find(chunk => chunk.docType === docType);
  }

  /**
   * Load a chunk file and cache its documents
   */
  private async loadChunk(chunkId: string): Promise<void> {
    if (this.chunkCache.has(chunkId)) {
      return; // Already loaded
    }

    const chunk = this.manifest.chunks.find(c => c.id === chunkId);
    if (!chunk) {
      throw new Error(`Chunk ${chunkId} not found in manifest`);
    }

    try {
      const chunkPath = `${this.basePath}/${chunk.path}`;
      logger.debug(`Loading chunk from ${chunkPath}`);
      
      const response = await fetch(chunkPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch chunk ${chunkId}: ${response.status} ${response.statusText}`);
      }
      
      const documents = await response.json();
      this.chunkCache.set(chunkId, documents);

      // Cache individual documents for quick lookup
      for (const doc of documents) {
        if (doc._id) {
          this.documentCache.set(doc._id, doc);
        }
      }

      logger.debug(`Loaded ${documents.length} documents from chunk ${chunkId}`);
    } catch (error) {
      logger.error(`Failed to load chunk ${chunkId}:`, error);
      throw error;
    }
  }

  /**
   * Load an index file and cache it
   */
  private async loadIndex(indexName: string): Promise<any> {
    if (this.indexCache.has(indexName)) {
      return this.indexCache.get(indexName);
    }

    const indexMeta = this.manifest.indices.find(idx => idx.name === indexName);
    if (!indexMeta) {
      throw new Error(`Index ${indexName} not found in manifest`);
    }

    try {
      const indexPath = `${this.basePath}/${indexMeta.path}`;
      logger.debug(`Loading index from ${indexPath}`);
      
      const response = await fetch(indexPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch index ${indexName}: ${response.status} ${response.statusText}`);
      }
      
      const indexData = await response.json();
      this.indexCache.set(indexName, indexData);

      logger.debug(`Loaded index ${indexName}`);
      return indexData;
    } catch (error) {
      logger.error(`Failed to load index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Clear all caches (useful for testing or memory management)
   */
  clearCaches(): void {
    this.documentCache.clear();
    this.chunkCache.clear();
    this.indexCache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): {
    documents: number;
    chunks: number;
    indices: number;
  } {
    return {
      documents: this.documentCache.size,
      chunks: this.chunkCache.size,
      indices: this.indexCache.size,
    };
  }
}