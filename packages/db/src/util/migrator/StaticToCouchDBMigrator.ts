// packages/db/src/util/migrator/StaticToCouchDBMigrator.ts

import { logger } from '../logger';
import { StaticCourseManifest, ChunkMetadata, DesignDocument } from '../packer/types';
import {
  MigrationOptions,
  MigrationResult,
  DEFAULT_MIGRATION_OPTIONS,
  DocumentCounts,
  RestoreProgress,
  AggregatedDocument,
  RestoreResults,
  AttachmentUploadResult,
} from './types';
import { validateStaticCourse, validateMigration } from './validation';
import { FileSystemAdapter, FileSystemError } from './FileSystemAdapter';

// Fallback for environments without FileSystemAdapter (backward compatibility)
let nodeFS: any = null;
let nodePath: any = null;
try {
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
    nodeFS = eval('require')('fs');
    nodePath = eval('require')('path');
    nodeFS.promises = nodeFS.promises || eval('require')('fs').promises;
  }
} catch {
  // fs not available, will use fetch
}

export class StaticToCouchDBMigrator {
  private options: MigrationOptions;
  private progressCallback?: (progress: RestoreProgress) => void;
  private fs?: FileSystemAdapter;

  constructor(options: Partial<MigrationOptions> = {}, fileSystemAdapter?: FileSystemAdapter) {
    this.options = {
      ...DEFAULT_MIGRATION_OPTIONS,
      ...options,
    };
    this.fs = fileSystemAdapter;
  }

  /**
   * Set a progress callback to receive updates during migration
   */
  setProgressCallback(callback: (progress: RestoreProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Migrate a static course to CouchDB
   */
  async migrateCourse(staticPath: string, targetDB: PouchDB.Database): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      documentsRestored: 0,
      attachmentsRestored: 0,
      designDocsRestored: 0,
      courseConfigRestored: 0,
      errors: [] as string[],
      warnings: [] as string[],
      migrationTime: 0,
    };

    try {
      logger.info(`Starting migration from ${staticPath} to CouchDB`);

      // Phase 1: Validate static course
      this.reportProgress('manifest', 0, 1, 'Validating static course...');
      const validation = await validateStaticCourse(staticPath, this.fs);
      if (!validation.valid) {
        result.errors.push(...validation.errors);
        throw new Error(`Static course validation failed: ${validation.errors.join(', ')}`);
      }
      result.warnings.push(...validation.warnings);

      // Phase 2: Load manifest
      this.reportProgress('manifest', 1, 1, 'Loading course manifest...');
      const manifest = await this.loadManifest(staticPath);
      logger.info(`Loaded manifest for course: ${manifest.courseId} (${manifest.courseName})`);

      // Phase 3: Restore design documents
      this.reportProgress(
        'design_docs',
        0,
        manifest.designDocs.length,
        'Restoring design documents...'
      );
      const designDocResults = await this.restoreDesignDocuments(manifest.designDocs, targetDB);
      result.designDocsRestored = designDocResults.restored;
      result.errors.push(...designDocResults.errors);
      result.warnings.push(...designDocResults.warnings);

      // Phase 3.5: Restore CourseConfig
      this.reportProgress('course_config', 0, 1, 'Restoring CourseConfig document...');
      const courseConfigResults = await this.restoreCourseConfig(manifest, targetDB);
      result.courseConfigRestored = courseConfigResults.restored;
      result.errors.push(...courseConfigResults.errors);
      result.warnings.push(...courseConfigResults.warnings);
      this.reportProgress('course_config', 1, 1, 'CourseConfig document restored');

      // Phase 4: Aggregate and restore documents
      const expectedCounts = this.calculateExpectedCounts(manifest);
      this.reportProgress(
        'documents',
        0,
        manifest.documentCount,
        'Aggregating documents from chunks...'
      );
      const documents = await this.aggregateDocuments(staticPath, manifest);

      // Filter out CourseConfig documents to prevent conflicts with Phase 3.5
      const filteredDocuments = documents.filter((doc) => doc._id !== 'CourseConfig');
      if (documents.length !== filteredDocuments.length) {
        result.warnings.push(
          `Filtered out ${documents.length - filteredDocuments.length} CourseConfig document(s) from chunks to prevent conflicts`
        );
      }

      this.reportProgress(
        'documents',
        filteredDocuments.length,
        manifest.documentCount,
        'Uploading documents to CouchDB...'
      );
      const docResults = await this.uploadDocuments(filteredDocuments, targetDB);
      result.documentsRestored = docResults.restored;
      result.errors.push(...docResults.errors);
      result.warnings.push(...docResults.warnings);

      // Phase 5: Upload attachments
      const docsWithAttachments = documents.filter(
        (doc) => doc._attachments && Object.keys(doc._attachments).length > 0
      );
      this.reportProgress('attachments', 0, docsWithAttachments.length, 'Uploading attachments...');
      const attachmentResults = await this.uploadAttachments(
        staticPath,
        docsWithAttachments,
        targetDB
      );
      result.attachmentsRestored = attachmentResults.restored;
      result.errors.push(...attachmentResults.errors);
      result.warnings.push(...attachmentResults.warnings);

      // Phase 6: Validation (if enabled)
      if (this.options.validateRoundTrip) {
        this.reportProgress('validation', 0, 1, 'Validating migration...');
        const validationResult = await validateMigration(targetDB, expectedCounts, manifest);
        if (!validationResult.valid) {
          result.warnings.push('Migration validation found issues');
          validationResult.issues.forEach((issue) => {
            if (issue.type === 'error') {
              result.errors.push(`Validation: ${issue.message}`);
            } else {
              result.warnings.push(`Validation: ${issue.message}`);
            }
          });
        }
        this.reportProgress('validation', 1, 1, 'Migration validation completed');
      }

      // Success!
      result.success = result.errors.length === 0;
      result.migrationTime = Date.now() - startTime;

      logger.info(`Migration completed in ${result.migrationTime}ms`);
      logger.info(`Documents restored: ${result.documentsRestored}`);
      logger.info(`Attachments restored: ${result.attachmentsRestored}`);
      logger.info(`Design docs restored: ${result.designDocsRestored}`);
      logger.info(`CourseConfig restored: ${result.courseConfigRestored}`);

      if (result.errors.length > 0) {
        logger.error(`Migration completed with ${result.errors.length} errors`);
      }
      if (result.warnings.length > 0) {
        logger.warn(`Migration completed with ${result.warnings.length} warnings`);
      }
    } catch (error) {
      result.success = false;
      result.migrationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Migration failed: ${errorMessage}`);
      logger.error('Migration failed:', error);

      // Cleanup on failure if requested
      if (this.options.cleanupOnFailure) {
        try {
          await this.cleanupFailedMigration(targetDB);
        } catch (cleanupError) {
          logger.error('Failed to cleanup after migration failure:', cleanupError);
          result.warnings.push('Failed to cleanup after migration failure');
        }
      }
    }

    return result;
  }

  /**
   * Load and parse the manifest file
   */
  private async loadManifest(staticPath: string): Promise<StaticCourseManifest> {
    try {
      let manifestContent: string;
      let manifestPath: string;

      if (this.fs) {
        // Use injected file system adapter (preferred)
        manifestPath = this.fs.joinPath(staticPath, 'manifest.json');
        manifestContent = await this.fs.readFile(manifestPath);
      } else {
        // Fallback to legacy behavior for backward compatibility
        manifestPath =
          nodeFS && nodePath
            ? nodePath.join(staticPath, 'manifest.json')
            : `${staticPath}/manifest.json`;

        if (nodeFS && this.isLocalPath(staticPath)) {
          // Node.js file system access
          manifestContent = await nodeFS.promises.readFile(manifestPath, 'utf8');
        } else {
          // Browser/fetch access
          const response = await fetch(manifestPath);
          if (!response.ok) {
            throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
          }
          manifestContent = await response.text();
        }
      }

      const manifest: StaticCourseManifest = JSON.parse(manifestContent);

      // Basic validation
      if (!manifest.version || !manifest.courseId || !manifest.chunks) {
        throw new Error('Invalid manifest structure');
      }

      return manifest;
    } catch (error) {
      const errorMessage =
        error instanceof FileSystemError
          ? error.message
          : `Failed to load manifest: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Restore design documents to CouchDB
   */
  private async restoreDesignDocuments(
    designDocs: DesignDocument[],
    db: PouchDB.Database
  ): Promise<{ restored: number; errors: string[]; warnings: string[] }> {
    const result = { restored: 0, errors: [] as string[], warnings: [] as string[] };

    for (let i = 0; i < designDocs.length; i++) {
      const designDoc = designDocs[i];
      this.reportProgress('design_docs', i, designDocs.length, `Restoring ${designDoc._id}...`);

      try {
        // Check if design document already exists
        let existingDoc;
        try {
          existingDoc = await db.get(designDoc._id);
        } catch {
          // Document doesn't exist, which is fine
        }

        // Prepare the document for insertion
        const docToInsert: any = {
          _id: designDoc._id,
          views: designDoc.views,
        };

        // If document exists, include the revision for update
        if (existingDoc) {
          docToInsert._rev = existingDoc._rev;
          logger.debug(`Updating existing design document: ${designDoc._id}`);
        } else {
          logger.debug(`Creating new design document: ${designDoc._id}`);
        }

        await db.put(docToInsert);
        result.restored++;
      } catch (error) {
        const errorMessage = `Failed to restore design document ${designDoc._id}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMessage);
        logger.error(errorMessage);
      }
    }

    this.reportProgress(
      'design_docs',
      designDocs.length,
      designDocs.length,
      `Restored ${result.restored} design documents`
    );
    return result;
  }

  /**
   * Aggregate documents from all chunks
   */
  private async aggregateDocuments(
    staticPath: string,
    manifest: StaticCourseManifest
  ): Promise<AggregatedDocument[]> {
    const allDocuments: AggregatedDocument[] = [];
    const documentMap = new Map<string, AggregatedDocument>(); // For deduplication

    for (let i = 0; i < manifest.chunks.length; i++) {
      const chunk = manifest.chunks[i];
      this.reportProgress(
        'documents',
        allDocuments.length,
        manifest.documentCount,
        `Loading chunk ${chunk.id}...`
      );

      try {
        const documents = await this.loadChunk(staticPath, chunk);

        for (const doc of documents) {
          if (!doc._id) {
            logger.warn(`Document without _id found in chunk ${chunk.id}, skipping`);
            continue;
          }

          // Handle potential duplicates (shouldn't happen, but be safe)
          if (documentMap.has(doc._id)) {
            logger.warn(`Duplicate document ID found: ${doc._id}, using latest version`);
          }

          documentMap.set(doc._id, doc);
        }
      } catch (error) {
        throw new Error(
          `Failed to load chunk ${chunk.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Convert map to array
    allDocuments.push(...documentMap.values());

    logger.info(
      `Aggregated ${allDocuments.length} unique documents from ${manifest.chunks.length} chunks`
    );
    return allDocuments;
  }

  /**
   * Load documents from a single chunk file
   */
  private async loadChunk(staticPath: string, chunk: ChunkMetadata): Promise<any[]> {
    try {
      let chunkContent: string;
      let chunkPath: string;

      if (this.fs) {
        // Use injected file system adapter (preferred)
        chunkPath = this.fs.joinPath(staticPath, chunk.path);
        chunkContent = await this.fs.readFile(chunkPath);
      } else {
        // Fallback to legacy behavior for backward compatibility
        chunkPath =
          nodeFS && nodePath
            ? nodePath.join(staticPath, chunk.path)
            : `${staticPath}/${chunk.path}`;

        if (nodeFS && this.isLocalPath(staticPath)) {
          // Node.js file system access
          chunkContent = await nodeFS.promises.readFile(chunkPath, 'utf8');
        } else {
          // Browser/fetch access
          const response = await fetch(chunkPath);
          if (!response.ok) {
            throw new Error(`Failed to fetch chunk: ${response.status} ${response.statusText}`);
          }
          chunkContent = await response.text();
        }
      }

      const documents = JSON.parse(chunkContent);

      if (!Array.isArray(documents)) {
        throw new Error('Chunk file does not contain an array of documents');
      }

      return documents;
    } catch (error) {
      const errorMessage =
        error instanceof FileSystemError
          ? error.message
          : `Failed to load chunk: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Upload documents to CouchDB in batches
   */
  private async uploadDocuments(
    documents: AggregatedDocument[],
    db: PouchDB.Database
  ): Promise<{ restored: number; errors: string[]; warnings: string[] }> {
    const result = { restored: 0, errors: [] as string[], warnings: [] as string[] };
    const batchSize = this.options.chunkBatchSize;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      this.reportProgress(
        'documents',
        i,
        documents.length,
        `Uploading batch ${Math.floor(i / batchSize) + 1}...`
      );

      try {
        // Prepare documents for bulk insert
        const docsToInsert = batch.map((doc) => {
          const cleanDoc = { ...doc };
          // Remove _rev if present (CouchDB will assign new revision)
          delete cleanDoc._rev;
          // Remove _attachments - these are uploaded separately in Phase 5
          delete cleanDoc._attachments;

          return cleanDoc;
        });

        const bulkResult = await db.bulkDocs(docsToInsert);

        // Process results
        for (let j = 0; j < bulkResult.length; j++) {
          const docResult = bulkResult[j];
          const originalDoc = batch[j];

          if ('error' in docResult) {
            const errorMessage = `Failed to upload document ${originalDoc._id}: ${docResult.error} - ${docResult.reason}`;
            result.errors.push(errorMessage);
            logger.error(errorMessage);
          } else {
            result.restored++;
          }
        }
      } catch (error) {
        let errorMessage: string;
        if (error instanceof Error) {
          errorMessage = `Failed to upload document batch starting at index ${i}: ${error.message}`;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = `Failed to upload document batch starting at index ${i}: ${(error as any).message}`;
        } else {
          errorMessage = `Failed to upload document batch starting at index ${i}: ${JSON.stringify(error)}`;
        }
        result.errors.push(errorMessage);
        logger.error(errorMessage);
      }
    }

    this.reportProgress(
      'documents',
      documents.length,
      documents.length,
      `Uploaded ${result.restored} documents`
    );
    return result;
  }

  /**
   * Upload attachments from filesystem to CouchDB
   */
  private async uploadAttachments(
    staticPath: string,
    documents: AggregatedDocument[],
    db: PouchDB.Database
  ): Promise<{ restored: number; errors: string[]; warnings: string[] }> {
    const result = { restored: 0, errors: [] as string[], warnings: [] as string[] };
    let processedDocs = 0;

    for (const doc of documents) {
      this.reportProgress(
        'attachments',
        processedDocs,
        documents.length,
        `Processing attachments for ${doc._id}...`
      );
      processedDocs++;

      if (!doc._attachments) {
        continue;
      }

      for (const [attachmentName, attachmentMeta] of Object.entries(doc._attachments)) {
        try {
          const uploadResult = await this.uploadSingleAttachment(
            staticPath,
            doc._id,
            attachmentName,
            attachmentMeta as any,
            db
          );

          if (uploadResult.success) {
            result.restored++;
          } else {
            result.errors.push(uploadResult.error || 'Unknown attachment upload error');
          }
        } catch (error) {
          const errorMessage = `Failed to upload attachment ${doc._id}/${attachmentName}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
          logger.error(errorMessage);
        }
      }
    }

    this.reportProgress(
      'attachments',
      documents.length,
      documents.length,
      `Uploaded ${result.restored} attachments`
    );
    return result;
  }

  /**
   * Upload a single attachment file
   */
  private async uploadSingleAttachment(
    staticPath: string,
    docId: string,
    attachmentName: string,
    attachmentMeta: any,
    db: PouchDB.Database
  ): Promise<AttachmentUploadResult> {
    const result: AttachmentUploadResult = {
      success: false,
      attachmentName,
      docId,
    };

    try {
      // Get the file path from the attachment metadata
      if (!attachmentMeta.path) {
        result.error = 'Attachment metadata missing file path';
        return result;
      }

      // Load the attachment data
      let attachmentData: ArrayBuffer | Buffer;
      let attachmentPath: string;

      if (this.fs) {
        // Use injected file system adapter (preferred)
        attachmentPath = this.fs.joinPath(staticPath, attachmentMeta.path);
        attachmentData = await this.fs.readBinary(attachmentPath);
      } else {
        // Fallback to legacy behavior for backward compatibility
        attachmentPath =
          nodeFS && nodePath
            ? nodePath.join(staticPath, attachmentMeta.path)
            : `${staticPath}/${attachmentMeta.path}`;

        if (nodeFS && this.isLocalPath(staticPath)) {
          // Node.js file system access
          attachmentData = await nodeFS.promises.readFile(attachmentPath);
        } else {
          // Browser/fetch access
          const response = await fetch(attachmentPath);
          if (!response.ok) {
            result.error = `Failed to fetch attachment: ${response.status} ${response.statusText}`;
            return result;
          }
          attachmentData = await response.arrayBuffer();
        }
      }

      // Get current document revision (needed for putAttachment)
      const doc = await db.get(docId);
      
      // Upload to CouchDB
      await db.putAttachment(
        docId,
        attachmentName,
        doc._rev,
        attachmentData as any, // PouchDB accepts both ArrayBuffer and Buffer
        attachmentMeta.content_type
      );

      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Restore CourseConfig document from manifest
   */
  private async restoreCourseConfig(
    manifest: StaticCourseManifest,
    targetDB: PouchDB.Database
  ): Promise<RestoreResults> {
    const results: RestoreResults = {
      restored: 0,
      errors: [],
      warnings: [],
    };

    try {
      // Validate courseConfig exists
      if (!manifest.courseConfig) {
        results.warnings.push(
          'No courseConfig found in manifest, skipping CourseConfig document creation'
        );
        return results;
      }

      // Create CourseConfig document
      const courseConfigDoc: { [key: string]: any; _id: string; _rev?: string } = {
        _id: 'CourseConfig',
        ...manifest.courseConfig,
        courseID: manifest.courseId,
      };
      delete courseConfigDoc._rev;

      // Upload to CouchDB
      await targetDB.put(courseConfigDoc);
      results.restored = 1;

      logger.info(`CourseConfig document created for course: ${manifest.courseId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      results.errors.push(`Failed to restore CourseConfig: ${errorMessage}`);
      logger.error('CourseConfig restoration failed:', error);
    }

    return results;
  }

  /**
   * Calculate expected document counts from manifest
   */
  private calculateExpectedCounts(manifest: StaticCourseManifest): DocumentCounts {
    const counts: DocumentCounts = {};

    // Count documents by type from chunks
    for (const chunk of manifest.chunks) {
      counts[chunk.docType] = (counts[chunk.docType] || 0) + chunk.documentCount;
    }

    // Count design documents
    if (manifest.designDocs.length > 0) {
      counts['_design'] = manifest.designDocs.length;
    }

    return counts;
  }

  /**
   * Clean up database after failed migration
   */
  private async cleanupFailedMigration(db: PouchDB.Database): Promise<void> {
    logger.info('Cleaning up failed migration...');

    try {
      // Get all documents and delete them
      const allDocs = await db.allDocs();
      const docsToDelete = allDocs.rows.map((row) => ({
        _id: row.id,
        _rev: row.value.rev,
        _deleted: true,
      }));

      if (docsToDelete.length > 0) {
        await db.bulkDocs(docsToDelete);
        logger.info(`Cleaned up ${docsToDelete.length} documents from failed migration`);
      }
    } catch (error) {
      logger.error('Failed to cleanup documents:', error);
      throw error;
    }
  }

  /**
   * Report progress to callback if available
   */
  private reportProgress(
    phase: RestoreProgress['phase'],
    current: number,
    total: number,
    message: string
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        phase,
        current,
        total,
        message,
      });
    }
  }

  /**
   * Check if a path is a local file path (vs URL)
   */
  private isLocalPath(path: string): boolean {
    return !path.startsWith('http://') && !path.startsWith('https://');
  }
}
