// packages/db/src/impl/static/StaticDataUnpacker.ts

import { StaticCourseManifest, ChunkMetadata } from '../../util/packer/types';
import { logger } from '../../util/logger';
import { DocType, DocTypePrefixes } from '@db/core';

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
      const doc = this.documentCache.get(id);
      return await this.hydrateAttachments(doc);
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
      const doc = this.documentCache.get(id);
      return await this.hydrateAttachments(doc);
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

  private getDocTypeFromId(id: string): DocType | undefined {
    for (const docTypeKey in DocTypePrefixes) {
      const prefix = DocTypePrefixes[docTypeKey as DocType];
      if (id.startsWith(`${prefix}-`)) {
        return docTypeKey as DocType;
      }
    }
    return undefined;
  }

  /**
   * Find which chunk contains a specific document ID
   */
  private async findChunkForDocument(docId: string): Promise<ChunkMetadata | undefined> {
    const expectedDocType = this.getDocTypeFromId(docId);

    if (expectedDocType) {
      const typeChunks = this.manifest.chunks.filter((c) => c.docType === expectedDocType);

      for (const chunk of typeChunks) {
        if (docId >= chunk.startKey && docId <= chunk.endKey) {
          const exists = await this.verifyDocumentInChunk(docId, chunk);
          if (exists) {
            return chunk;
          }
        }
      }
    } else {
      // Fallback for documents without recognized prefixes (e.g., CourseConfig, or old documents)
      // This part remains for backward compatibility and non-prefixed documents.
      // It's less efficient but necessary if not all document types are prefixed.
      for (const chunk of this.manifest.chunks) {
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
    return undefined;
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
   * Get a document by ID without hydration (raw document access)
   * Used internally to avoid recursion during attachment hydration
   */
  private async getRawDocument<T = any>(id: string): Promise<T> {
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
   * Get attachment URL for a given document and attachment name
   */
  getAttachmentUrl(docId: string, attachmentName: string): string {
    // Construct attachment path: attachments/{docId}/{attachmentName}.{ext}
    // The exact filename will be resolved from the document's _attachments metadata
    return `${this.basePath}/attachments/${docId}/${attachmentName}`;
  }

  /**
   * Load attachment data from the document and get the correct file path
   * Uses raw document access to avoid recursion with hydration
   */
  async getAttachmentPath(docId: string, attachmentName: string): Promise<string | null> {
    try {
      const doc = await this.getRawDocument(docId);
      if (doc._attachments && doc._attachments[attachmentName]) {
        const attachment = doc._attachments[attachmentName];
        if (attachment.path) {
          // Return the full path as stored in the document
          return `${this.basePath}/${attachment.path}`;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Load attachment as a blob (for browser) or buffer (for Node.js)
   */
  async getAttachmentBlob(docId: string, attachmentName: string): Promise<Blob | Buffer | null> {
    const attachmentPath = await this.getAttachmentPath(docId, attachmentName);
    if (!attachmentPath) {
      return null;
    }

    try {
      // Check if we're in a Node.js environment with local files
      if (this.isLocalPath(attachmentPath) && nodeFS) {
        // Use fs for local file access (e.g., in tests)
        const buffer = await nodeFS.promises.readFile(attachmentPath);
        return buffer;
      } else {
        // Use fetch for URL-based access (e.g., in browser)
        const response = await fetch(attachmentPath);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch attachment ${docId}/${attachmentName}: ${response.status} ${response.statusText}`
          );
        }
        return await response.blob();
      }
    } catch (error) {
      logger.error(`Failed to load attachment ${docId}/${attachmentName}:`, error);
      return null;
    }
  }

  /**
   * Hydrate document attachments by converting file paths to blob URLs
   */
  private async hydrateAttachments<T = any>(doc: T): Promise<T> {
    // logger.debug(`[hydrateAttachments] Starting hydration for doc: ${JSON.stringify(doc)}`);
    const typedDoc = doc as any;

    // If no attachments, return document as-is
    if (!typedDoc._attachments) {
      return doc;
    }

    // Clone the document to avoid mutating the cached version
    const hydratedDoc = JSON.parse(JSON.stringify(doc));

    // Process each attachment
    for (const [attachmentName, attachment] of Object.entries(typedDoc._attachments)) {
      // logger.debug(
      //   `[hydrateAttachments] Processing attachment: ${attachmentName} for doc ${typedDoc?._id}`
      // );
      const attachmentData = attachment as any;

      // If attachment has a path, convert it to a blob URL
      if (attachmentData.path) {
        // logger.debug(
        //   `[hydrateAttachments] Attachment ${attachmentName} has path: ${attachmentData.path}. Attempting to get blob.`
        // );
        try {
          const blob = await this.getAttachmentBlob(typedDoc._id, attachmentName);
          if (blob) {
            // logger.debug(
            //   `[hydrateAttachments] Successfully retrieved blob for ${typedDoc._id}/${attachmentName}. Size: ${blob instanceof Blob ? blob.size : (blob as Buffer).length}`
            // );
            // Create blob URL for browser rendering
            if (typeof window !== 'undefined' && window.URL) {
              // Store attachment data in PouchDB-compatible format
              hydratedDoc._attachments[attachmentName] = {
                ...attachmentData,
                data: blob,
                stub: false, // Indicates this contains actual data, not just metadata
              };
              // logger.debug(
              //   `[hydrateAttachments] Added blobUrl and blob to attachment ${attachmentName} for doc ${typedDoc._id}.`
              // );
            } else {
              // In Node.js environment, just attach the buffer
              hydratedDoc._attachments[attachmentName] = {
                ...attachmentData,
                buffer: blob, // Attach buffer for Node.js use
              };
              // logger.debug(
              //   `[hydrateAttachments] Added buffer to attachment ${attachmentName} for doc ${typedDoc._id}.`
              // );
            }
          } else {
            logger.warn(
              `[hydrateAttachments] getAttachmentBlob returned null for ${typedDoc._id}/${attachmentName}. Skipping hydration for this attachment.`
            );
          }
        } catch (error) {
          logger.warn(
            `[hydrateAttachments] Failed to hydrate attachment ${typedDoc._id}/${attachmentName}:`,
            error
          );
          // Keep original attachment data if hydration fails
        }
      } else {
        logger.debug(
          `[hydrateAttachments] Attachment ${attachmentName} for doc ${typedDoc._id} has no path. Skipping blob conversion.`
        );
      }
    }

    // logger.debug(
    //   `[hydrateAttachments] Finished hydration for doc ${typedDoc?._id}. Returning hydrated doc: ${JSON.stringify(hydratedDoc)}`
    // );
    return hydratedDoc;
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
