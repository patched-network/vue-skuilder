// packages/db/src/util/migrator/types.ts

export interface MigrationOptions {
  chunkBatchSize: number;
  validateRoundTrip: boolean;
  cleanupOnFailure: boolean;
  timeout: number; // milliseconds
}

export interface MigrationResult {
  success: boolean;
  documentsRestored: number;
  attachmentsRestored: number;
  designDocsRestored: number;
  courseConfigRestored: number;
  errors: string[];
  warnings: string[];
  migrationTime: number;
  tempDatabaseName?: string;
}

export interface ValidationResult {
  valid: boolean;
  documentCountMatch: boolean;
  attachmentIntegrity: boolean;
  viewFunctionality: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  category: 'documents' | 'attachments' | 'views' | 'metadata' | 'course_config';
  message: string;
  details?: any;
}

export interface DocumentCounts {
  [docType: string]: number;
}

export interface RestoreProgress {
  phase: 'manifest' | 'design_docs' | 'course_config' | 'documents' | 'attachments' | 'validation';
  current: number;
  total: number;
  message: string;
}

export interface StaticCourseValidation {
  valid: boolean;
  manifestExists: boolean;
  chunksExist: boolean;
  attachmentsExist: boolean;
  errors: string[];
  warnings: string[];
  courseId?: string;
  courseName?: string;
}

export interface AggregatedDocument {
  _id: string;
  _attachments?: Record<string, any>;
  docType: string;
  [key: string]: any;
}

export interface RestoreResults {
  restored: number;
  errors: string[];
  warnings: string[];
}

export interface AttachmentUploadResult {
  success: boolean;
  attachmentName: string;
  docId: string;
  error?: string;
}

export const DEFAULT_MIGRATION_OPTIONS: MigrationOptions = {
  chunkBatchSize: 100,
  validateRoundTrip: false,
  cleanupOnFailure: true,
  timeout: 300000, // 5 minutes
};
