// packages/db/src/impl/static/StaticDataUnpacker.ts

import { StaticCourseManifest, ChunkMetadata } from '../../util/packer/types';
import { logger } from '../../util/logger';
import { DocType } from '@db/core';

// Browser-compatible path utilities
const pathUtils = {
  isAbsolute: (path: string): boolean => {
    // Check for Windows absolute paths (C:\ or \\server\)
    if (/^[a-zA-Z]:[\\/]/.test(path) || /^\\\\/.test(path)) {
      return true;
    }
    // Check for Unix absolute paths (/)
    if (path.startsWith('/')) {
      return true;
    }
    return false;
  },
};

// Check if we're in Node.js environment and fs is available
let nodeFS: any = null;
try {
  // Use eval to prevent bundlers from including fs in browser builds
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
    nodeFS = eval('require')('fs');
  }
} catch {
  // fs not available, will use fetch
}

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
    const chunk = await this.findChunkForDocument(id);
    if (!chunk) {
      logger.error(
        `Document ${id} not found in any chunk. Available chunks:`,
        this.manifest.chunks.map((c) => `${c.id} (${c.docType}): ${c.startKey} - ${c.endKey}`)
      );
      throw new Error(`Document ${id} not found in any chunk`);
    }

    // Load the chunk if not cached
    await this.loadChunk(chunk.id);

    // Try to get the document from cache again
    if (this.documentCache.has(id)) {
      return this.documentCache.get(id);
    }

    logger.error(`Document ${id} not found in chunk ${chunk.id}`);
    throw new Error(`Document ${id} not found in chunk ${chunk.id}`);
  }

  /**
   * Query cards by ELO score, returning card IDs sorted by ELO
   */
  async queryByElo(targetElo: number, limit: number = 25): Promise<string[]> {
    const eloIndex = (await this.loadIndex('elo')) as EloIndex;

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
    for (
      let i = Math.max(0, startIndex - halfLimit);
      i < startIndex && result.length < limit;
      i++
    ) {
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
    return (await this.loadIndex('tags')) as TagsIndex;
  }

  /**
   * Find which chunk contains a specific document ID
   */
  private async findChunkForDocument(docId: string): Promise<ChunkMetadata | undefined> {
    // Determine document type from ID pattern by checking all DocType enum members
    let expectedDocType: DocType | undefined = undefined;

    // Check for ID prefixes matching any DocType enum value
    for (const docType of Object.values(DocType)) {
      if (docId.startsWith(`${docType}-`)) {
        expectedDocType = docType;
        break;
      }
    }

    if (expectedDocType !== undefined) {
      // Use chunk filtering by docType for documents with recognized prefixes
      const typeChunks = this.manifest.chunks.filter((c) => c.docType === expectedDocType);

      for (const chunk of typeChunks) {
        if (docId >= chunk.startKey && docId <= chunk.endKey) {
          // Verify document actually exists in chunk
          const exists = await this.verifyDocumentInChunk(docId, chunk);
          if (exists) {
            return chunk;
          }
        }
      }

      return undefined;
    } else {
      // Fall back to trying all chunk types with strict verification
      // Since card IDs and displayable data IDs can overlap in range, we need to verify actual existence

      // First try DISPLAYABLE_DATA chunks (most likely for documents without prefixes)
      const displayableChunks = this.manifest.chunks.filter(
        (c) => c.docType === 'DISPLAYABLE_DATA'
      );
      for (const chunk of displayableChunks) {
        if (docId >= chunk.startKey && docId <= chunk.endKey) {
          // Verify document actually exists in chunk
          const exists = await this.verifyDocumentInChunk(docId, chunk);
          if (exists) {
            return chunk;
          }
        }
      }

      // Then try CARD chunks (for legacy card IDs without prefixes)
      const cardChunks = this.manifest.chunks.filter((c) => c.docType === 'CARD');
      for (const chunk of cardChunks) {
        if (docId >= chunk.startKey && docId <= chunk.endKey) {
          // Verify document actually exists in chunk
          const exists = await this.verifyDocumentInChunk(docId, chunk);
          if (exists) {
            return chunk;
          }
        }
      }

      // Finally try any other chunk types
      const otherChunks = this.manifest.chunks.filter(
        (c) => c.docType !== 'CARD' && c.docType !== 'DISPLAYABLE_DATA' && c.docType !== 'TAG'
      );
      for (const chunk of otherChunks) {
        if (docId >= chunk.startKey && docId <= chunk.endKey) {
          // Verify document actually exists in chunk
          const exists = await this.verifyDocumentInChunk(docId, chunk);
          if (exists) {
            return chunk;
          }
        }
      }

      return undefined;
    }
  }

  /**
   * Verify that a document actually exists in a specific chunk by loading and checking it
   */
  private async verifyDocumentInChunk(docId: string, chunk: ChunkMetadata): Promise<boolean> {
    try {
      // Load the chunk if not already cached
      await this.loadChunk(chunk.id);

      // Check if the document is now in our document cache
      return this.documentCache.has(docId);
    } catch {
      return false;
    }
  }

  /**
   * Load a chunk file and cache its documents
   */
  private async loadChunk(chunkId: string): Promise<void> {
    if (this.chunkCache.has(chunkId)) {
      return; // Already loaded
    }

    const chunk = this.manifest.chunks.find((c) => c.id === chunkId);
    if (!chunk) {
      throw new Error(`Chunk ${chunkId} not found in manifest`);
    }

    try {
      const chunkPath = `${this.basePath}/${chunk.path}`;
      logger.debug(`Loading chunk from ${chunkPath}`);

      let documents: any[];

      // Check if we're in a Node.js environment with local files
      if (this.isLocalPath(chunkPath) && nodeFS) {
        // Use fs for local file access (e.g., in tests)
        const fileContent = await nodeFS.promises.readFile(chunkPath, 'utf8');
        documents = JSON.parse(fileContent);
      } else {
        // Use fetch for URL-based access (e.g., in browser)
        const response = await fetch(chunkPath);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch chunk ${chunkId}: ${response.status} ${response.statusText}`
          );
        }
        documents = await response.json();
      }

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

    const indexMeta = this.manifest.indices.find((idx) => idx.name === indexName);
    if (!indexMeta) {
      throw new Error(`Index ${indexName} not found in manifest`);
    }

    try {
      const indexPath = `${this.basePath}/${indexMeta.path}`;
      logger.debug(`Loading index from ${indexPath}`);

      let indexData: any;

      // Check if we're in a Node.js environment with local files
      if (this.isLocalPath(indexPath) && nodeFS) {
        // Use fs for local file access (e.g., in tests)
        const fileContent = await nodeFS.promises.readFile(indexPath, 'utf8');
        indexData = JSON.parse(fileContent);
      } else {
        // Use fetch for URL-based access (e.g., in browser)
        const response = await fetch(indexPath);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch index ${indexName}: ${response.status} ${response.statusText}`
          );
        }
        indexData = await response.json();
      }

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

  /**
   * Check if a path is a local file path (vs URL)
   */
  private isLocalPath(filePath: string): boolean {
    // Check if it's an absolute path or doesn't start with http/https
    return (
      !filePath.startsWith('http://') &&
      !filePath.startsWith('https://') &&
      (pathUtils.isAbsolute(filePath) || filePath.startsWith('./') || filePath.startsWith('../'))
    );
  }
}
