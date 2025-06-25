// packages/db/src/util/migrator/index.ts

export { StaticToCouchDBMigrator } from './StaticToCouchDBMigrator';
export { validateStaticCourse, validateMigration } from './validation';
export type { FileSystemAdapter, FileStats } from './FileSystemAdapter';
export { FileSystemError } from './FileSystemAdapter';
export type {
  MigrationOptions,
  MigrationResult,
  ValidationResult,
  ValidationIssue,
  DocumentCounts,
  RestoreProgress,
  StaticCourseValidation,
  AggregatedDocument,
  AttachmentUploadResult,
  DEFAULT_MIGRATION_OPTIONS
} from './types';