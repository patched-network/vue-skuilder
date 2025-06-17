// packages/db/src/util/packer/CouchDBToStaticPacker.ts

import { CardData, DocType, Tag } from '../../core/types/types-legacy';
import { logger } from '../logger';
// CourseConfig interface - simplified for packer use

import { CourseConfig } from '@vue-skuilder/common';
import {
  ChunkMetadata,
  DesignDocument,
  IndexMetadata,
  PackedCourseData,
  PackerConfig,
  StaticCourseManifest,
  AttachmentData,
} from './types';

export class CouchDBToStaticPacker {
  private config: PackerConfig;
  private sourceDB: PouchDB.Database | null = null;

  constructor(config: Partial<PackerConfig> = {}) {
    this.config = {
      chunkSize: 1000,
      includeAttachments: true,
      ...config,
    };
  }

  /**
   * Pack a CouchDB course database into static data structures
   */
  async packCourse(sourceDB: PouchDB.Database, courseId: string): Promise<PackedCourseData> {
    logger.info(`Starting static pack for course: ${courseId}`);
    this.sourceDB = sourceDB;

    const manifest: StaticCourseManifest = {
      version: '1.0.0',
      courseId,
      courseName: '',
      courseConfig: null,
      lastUpdated: new Date().toISOString(),
      documentCount: 0,
      chunks: [],
      indices: [],
      designDocs: [],
    };

    // 1. Extract course config
    const courseConfig = await this.extractCourseConfig(sourceDB);
    manifest.courseName = courseConfig.name;
    manifest.courseConfig = courseConfig;

    // 2. Extract and process design documents
    manifest.designDocs = await this.extractDesignDocs(sourceDB);

    // 3. Extract all documents by type and create chunks
    const docsByType = await this.extractDocumentsByType(sourceDB);

    // 4. Extract attachments if enabled
    const attachments = new Map<string, AttachmentData>();
    if (this.config.includeAttachments) {
      await this.extractAllAttachments(docsByType, attachments);
    }

    // 5. Create chunks and prepare chunk data
    const chunks = new Map<string, any[]>();
    for (const [docType, docs] of Object.entries(docsByType)) {
      const chunkMetadata = this.createChunks(docs, docType as DocType);
      manifest.chunks.push(...chunkMetadata);
      manifest.documentCount += docs.length;

      // Prepare chunk data
      this.prepareChunkData(chunkMetadata, docs, chunks);
    }

    // 6. Build indices
    const indices = new Map<string, any>();
    manifest.indices = await this.buildIndices(docsByType, manifest.designDocs, indices);

    return {
      manifest,
      chunks,
      indices,
      attachments,
    };
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

      const doc = row.doc as any;
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
        path: `chunks/${chunkId}.json`,
      });
    }

    return chunks;
  }

  private prepareChunkData(
    chunkMetadata: ChunkMetadata[],
    docs: any[],
    chunks: Map<string, any[]>
  ): void {
    const sortedDocs = docs.sort((a, b) => a._id.localeCompare(b._id));

    for (const chunk of chunkMetadata) {
      const chunkDocs = sortedDocs.filter(
        (doc) => doc._id >= chunk.startKey && doc._id <= chunk.endKey
      );

      // Clean documents for storage
      const cleanedDocs = chunkDocs.map((doc) => {
        const cleaned = { ...doc };
        delete cleaned._rev; // Remove revision info
        
        if (this.config.includeAttachments && cleaned._attachments) {
          // Transform attachment stubs to file paths
          cleaned._attachments = this.transformAttachmentStubs(cleaned._attachments, cleaned._id);
        } else if (!this.config.includeAttachments) {
          delete cleaned._attachments;
        }
        
        return cleaned;
      });

      chunks.set(chunk.id, cleanedDocs);
    }
  }

  private async buildIndices(
    docsByType: Record<DocType, any[]>,
    designDocs: DesignDocument[],
    indices: Map<string, any>
  ): Promise<IndexMetadata[]> {
    const indexMetadata: IndexMetadata[] = [];

    // Build ELO index
    if (docsByType[DocType.CARD]) {
      const eloIndexMeta = await this.buildEloIndex(
        docsByType[DocType.CARD] as CardData[],
        indices
      );
      indexMetadata.push(eloIndexMeta);
    }

    // Build tag indices
    if (docsByType[DocType.TAG]) {
      const tagIndexMeta = await this.buildTagIndex(docsByType[DocType.TAG] as Tag[], indices);
      indexMetadata.push(tagIndexMeta);
    }

    // Build indices from design documents
    for (const designDoc of designDocs) {
      for (const [viewName, viewDef] of Object.entries(designDoc.views)) {
        if (viewDef.map) {
          const indexMeta = await this.buildViewIndex(
            viewName,
            viewDef.map,
            docsByType,
            indices,
            viewDef.reduce
          );
          if (indexMeta) indexMetadata.push(indexMeta);
        }
      }
    }

    return indexMetadata;
  }

  private async buildEloIndex(
    cards: CardData[],
    indices: Map<string, any>
  ): Promise<IndexMetadata> {
    // Build a B-tree like structure for ELO queries
    const eloIndex: Array<{ elo: number; cardId: string }> = [];

    for (const card of cards) {
      if (card.elo?.global?.score) {
        eloIndex.push({
          elo: card.elo.global.score,
          cardId: (card as any)._id,
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

    // Store the index data
    indices.set('elo', {
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
    };
  }

  private async buildTagIndex(tags: Tag[], indices: Map<string, any>): Promise<IndexMetadata> {
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

    indices.set('tags', {
      byTag: tagIndex,
      byCard: cardToTags,
    });

    return {
      name: 'tags',
      type: 'hash',
      path: 'indices/tags.json',
    };
  }

  private async buildViewIndex(
    viewName: string,
    mapFunction: string,
    docsByType: Record<DocType, any[]>,
    indices: Map<string, any>,
    _reduceFunction?: string
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

      indices.set(`view-${viewName}`, viewResults);

      return {
        name: `view-${viewName}`,
        type: 'btree',
        path: `indices/view-${viewName}.json`,
      };
    } catch (error) {
      logger.error(`Failed to build index for view ${viewName}:`, error);
      return null;
    }
  }

  /**
   * Extract all attachments from documents and download binary data
   */
  private async extractAllAttachments(
    docsByType: Record<DocType, any[]>,
    attachments: Map<string, AttachmentData>
  ): Promise<void> {
    logger.info('Extracting attachments...');
    
    const allDocs: any[] = [];
    for (const docs of Object.values(docsByType)) {
      allDocs.push(...docs);
    }

    const docsWithAttachments = allDocs.filter(doc => doc._attachments && Object.keys(doc._attachments).length > 0);
    
    if (docsWithAttachments.length === 0) {
      logger.info('No attachments found');
      return;
    }

    logger.info(`Found ${docsWithAttachments.length} documents with attachments`);

    // Process attachments concurrently
    const extractionPromises = docsWithAttachments.map(doc => 
      this.extractDocumentAttachments(doc, attachments)
    );

    await Promise.all(extractionPromises);
    
    logger.info(`Extracted ${attachments.size} attachment files`);
  }

  /**
   * Extract attachments for a single document
   */
  private async extractDocumentAttachments(
    doc: any,
    attachments: Map<string, AttachmentData>
  ): Promise<void> {
    if (!doc._attachments || !this.sourceDB) {
      return;
    }

    const docId = doc._id;
    
    for (const [attachmentName, metadata] of Object.entries(doc._attachments as Record<string, any>)) {
      try {
        // Download attachment binary data
        const attachmentResponse = await this.sourceDB.getAttachment(docId, attachmentName);
        
        // Convert to buffer
        let buffer: Buffer;
        if (attachmentResponse instanceof ArrayBuffer) {
          buffer = Buffer.from(attachmentResponse);
        } else if (Buffer.isBuffer(attachmentResponse)) {
          buffer = attachmentResponse;
        } else {
          // For browser environments, the response might be a Blob
          const blob = attachmentResponse as Blob;
          buffer = Buffer.from(await blob.arrayBuffer());
        }

        // Generate filename with proper extension
        const extension = this.getFileExtension(metadata.content_type);
        const filename = `${attachmentName}${extension}`;
        const attachmentPath = `attachments/${docId}/${filename}`;
        
        // Store attachment data
        attachments.set(attachmentPath, {
          docId,
          attachmentName,
          filename,
          path: attachmentPath,
          contentType: metadata.content_type,
          length: metadata.length || buffer.length,
          digest: metadata.digest,
          buffer,
        });

        logger.debug(`Extracted attachment: ${attachmentPath}`);
      } catch (error) {
        logger.error(`Failed to extract attachment ${docId}/${attachmentName}:`, error);
        throw new Error(`Failed to extract attachment ${docId}/${attachmentName}: ${error}`);
      }
    }
  }

  /**
   * Transform attachment stubs to include file paths
   */
  private transformAttachmentStubs(
    attachments: Record<string, any>,
    docId: string
  ): Record<string, any> {
    const transformed: Record<string, any> = {};
    
    for (const [attachmentName, metadata] of Object.entries(attachments)) {
      const extension = this.getFileExtension(metadata.content_type);
      const filename = `${attachmentName}${extension}`;
      const attachmentPath = `attachments/${docId}/${filename}`;
      
      transformed[attachmentName] = {
        path: attachmentPath,
        content_type: metadata.content_type,
        length: metadata.length,
        digest: metadata.digest,
        stub: false, // No longer a stub - we have the actual file
      };
    }
    
    return transformed;
  }

  /**
   * Get file extension from content type
   */
  private getFileExtension(contentType: string): string {
    const extensionMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg', 
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/json': '.json',
    };
    
    return extensionMap[contentType] || '';
  }
}
