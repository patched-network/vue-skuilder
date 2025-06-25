// packages/db/src/util/migrator/validation.ts

import { logger } from '../logger';
import { StaticCourseValidation, ValidationResult, DocumentCounts, ValidationIssue } from './types';
import { StaticCourseManifest } from '../packer/types';

// Check if we're in Node.js environment and fs is available
let nodeFS: any = null;
try {
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
    nodeFS = eval('require')('fs');
    nodeFS.promises = nodeFS.promises || eval('require')('fs').promises;
  }
} catch {
  // fs not available
}

/**
 * Validate that a static course directory contains all required files
 */
export async function validateStaticCourse(staticPath: string): Promise<StaticCourseValidation> {
  const validation: StaticCourseValidation = {
    valid: true,
    manifestExists: false,
    chunksExist: false,
    attachmentsExist: false,
    errors: [],
    warnings: [],
  };

  try {
    // Check if path exists and is directory
    if (!nodeFS) {
      validation.errors.push('File system access not available - validation skipped');
      validation.valid = false;
      return validation;
    }

    const stats = await nodeFS.promises.stat(staticPath);
    if (!stats.isDirectory()) {
      validation.errors.push(`Path is not a directory: ${staticPath}`);
      validation.valid = false;
      return validation;
    }

    // Check for manifest.json
    const manifestPath = `${staticPath}/manifest.json`;
    try {
      await nodeFS.promises.access(manifestPath);
      validation.manifestExists = true;

      // Parse manifest to get course info
      const manifestContent = await nodeFS.promises.readFile(manifestPath, 'utf8');
      const manifest: StaticCourseManifest = JSON.parse(manifestContent);
      validation.courseId = manifest.courseId;
      validation.courseName = manifest.courseName;

      // Validate manifest structure
      if (
        !manifest.version ||
        !manifest.courseId ||
        !manifest.chunks ||
        !Array.isArray(manifest.chunks)
      ) {
        validation.errors.push('Invalid manifest structure');
        validation.valid = false;
      }
    } catch (error) {
      validation.errors.push(`Manifest not found or invalid: ${manifestPath}`);
      validation.valid = false;
    }

    // Check for chunks directory
    const chunksPath = `${staticPath}/chunks`;
    try {
      const chunksStats = await nodeFS.promises.stat(chunksPath);
      if (chunksStats.isDirectory()) {
        validation.chunksExist = true;
      } else {
        validation.errors.push(`Chunks path is not a directory: ${chunksPath}`);
        validation.valid = false;
      }
    } catch (error) {
      validation.errors.push(`Chunks directory not found: ${chunksPath}`);
      validation.valid = false;
    }

    // Check for attachments directory (optional - course might not have attachments)
    const attachmentsPath = `${staticPath}/attachments`;
    try {
      const attachmentsStats = await nodeFS.promises.stat(attachmentsPath);
      if (attachmentsStats.isDirectory()) {
        validation.attachmentsExist = true;
      }
    } catch (error) {
      // Attachments directory is optional
      validation.warnings.push(
        `Attachments directory not found: ${attachmentsPath} (this is OK if course has no attachments)`
      );
    }
  } catch (error) {
    validation.errors.push(
      `Failed to validate static course: ${error instanceof Error ? error.message : String(error)}`
    );
    validation.valid = false;
  }

  return validation;
}

/**
 * Validate the result of a migration by checking document counts and integrity
 */
export async function validateMigration(
  targetDB: PouchDB.Database,
  expectedCounts: DocumentCounts,
  manifest: StaticCourseManifest
): Promise<ValidationResult> {
  const validation: ValidationResult = {
    valid: true,
    documentCountMatch: false,
    attachmentIntegrity: false,
    viewFunctionality: false,
    issues: [],
  };

  try {
    logger.info('Starting migration validation...');

    // 1. Validate document counts
    const actualCounts = await getActualDocumentCounts(targetDB);
    validation.documentCountMatch = compareDocumentCounts(
      expectedCounts,
      actualCounts,
      validation.issues
    );

    // 2. Validate design documents and views
    validation.viewFunctionality = await validateViews(targetDB, manifest, validation.issues);

    // 3. Validate attachment integrity (sample check)
    validation.attachmentIntegrity = await validateAttachmentIntegrity(targetDB, validation.issues);

    // Overall validation result
    validation.valid =
      validation.documentCountMatch &&
      validation.viewFunctionality &&
      validation.attachmentIntegrity;

    logger.info(`Migration validation completed. Valid: ${validation.valid}`);
    if (validation.issues.length > 0) {
      logger.info(`Validation issues: ${validation.issues.length}`);
      validation.issues.forEach((issue) => {
        if (issue.type === 'error') {
          logger.error(`${issue.category}: ${issue.message}`);
        } else {
          logger.warn(`${issue.category}: ${issue.message}`);
        }
      });
    }
  } catch (error) {
    validation.valid = false;
    validation.issues.push({
      type: 'error',
      category: 'metadata',
      message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return validation;
}

/**
 * Get actual document counts by type from the database
 */
async function getActualDocumentCounts(db: PouchDB.Database): Promise<DocumentCounts> {
  const counts: DocumentCounts = {};

  try {
    const allDocs = await db.allDocs({ include_docs: true });

    for (const row of allDocs.rows) {
      if (row.id.startsWith('_design/')) {
        // Count design documents separately
        counts['_design'] = (counts['_design'] || 0) + 1;
        continue;
      }

      const doc = row.doc as any;
      if (doc && doc.docType) {
        counts[doc.docType] = (counts[doc.docType] || 0) + 1;
      } else {
        // Documents without docType
        counts['unknown'] = (counts['unknown'] || 0) + 1;
      }
    }
  } catch (error) {
    logger.error('Failed to get actual document counts:', error);
  }

  return counts;
}

/**
 * Compare expected vs actual document counts
 */
function compareDocumentCounts(
  expected: DocumentCounts,
  actual: DocumentCounts,
  issues: ValidationIssue[]
): boolean {
  let countsMatch = true;

  // Check each expected document type
  for (const [docType, expectedCount] of Object.entries(expected)) {
    const actualCount = actual[docType] || 0;

    if (actualCount !== expectedCount) {
      countsMatch = false;
      issues.push({
        type: 'error',
        category: 'documents',
        message: `Document count mismatch for ${docType}: expected ${expectedCount}, got ${actualCount}`,
      });
    }
  }

  // Check for unexpected document types
  for (const [docType, actualCount] of Object.entries(actual)) {
    if (!expected[docType] && docType !== '_design') {
      issues.push({
        type: 'warning',
        category: 'documents',
        message: `Unexpected document type found: ${docType} (${actualCount} documents)`,
      });
    }
  }

  return countsMatch;
}

/**
 * Validate that design documents and views are working correctly
 */
async function validateViews(
  db: PouchDB.Database,
  manifest: StaticCourseManifest,
  issues: ValidationIssue[]
): Promise<boolean> {
  let viewsValid = true;

  try {
    // Check that design documents exist
    for (const designDoc of manifest.designDocs) {
      try {
        const doc = await db.get(designDoc._id);
        if (!doc) {
          viewsValid = false;
          issues.push({
            type: 'error',
            category: 'views',
            message: `Design document not found: ${designDoc._id}`,
          });
          continue;
        }

        // Test each view in the design document
        for (const viewName of Object.keys(designDoc.views)) {
          try {
            const viewPath = `${designDoc._id}/${viewName}`;
            await db.query(viewPath, { limit: 1 });
            // If we get here, the view is accessible (even if it returns no results)
          } catch (viewError) {
            viewsValid = false;
            issues.push({
              type: 'error',
              category: 'views',
              message: `View not accessible: ${designDoc._id}/${viewName} - ${viewError}`,
            });
          }
        }
      } catch (error) {
        viewsValid = false;
        issues.push({
          type: 'error',
          category: 'views',
          message: `Failed to validate design document ${designDoc._id}: ${error}`,
        });
      }
    }
  } catch (error) {
    viewsValid = false;
    issues.push({
      type: 'error',
      category: 'views',
      message: `View validation failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return viewsValid;
}

/**
 * Validate attachment integrity by checking a sample of attachments
 */
async function validateAttachmentIntegrity(
  db: PouchDB.Database,
  issues: ValidationIssue[]
): Promise<boolean> {
  let attachmentsValid = true;

  try {
    // Get documents with attachments (sample check)
    const allDocs = await db.allDocs({
      include_docs: true,
      limit: 10, // Sample first 10 documents for performance
    });

    let attachmentCount = 0;
    let validAttachments = 0;

    for (const row of allDocs.rows) {
      const doc = row.doc as any;
      if (doc && doc._attachments) {
        for (const [attachmentName, _attachmentMeta] of Object.entries(doc._attachments)) {
          attachmentCount++;

          try {
            // Try to access the attachment
            const attachment = await db.getAttachment(doc._id, attachmentName);
            if (attachment) {
              validAttachments++;
            }
          } catch (attachmentError) {
            attachmentsValid = false;
            issues.push({
              type: 'error',
              category: 'attachments',
              message: `Attachment not accessible: ${doc._id}/${attachmentName} - ${attachmentError}`,
            });
          }
        }
      }
    }

    if (attachmentCount === 0) {
      // No attachments found - this is OK
      issues.push({
        type: 'warning',
        category: 'attachments',
        message: 'No attachments found in sampled documents',
      });
    } else {
      logger.info(`Validated ${validAttachments}/${attachmentCount} sampled attachments`);
    }
  } catch (error) {
    attachmentsValid = false;
    issues.push({
      type: 'error',
      category: 'attachments',
      message: `Attachment validation failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return attachmentsValid;
}
