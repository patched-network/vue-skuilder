// db/src/core/interfaces.ts

import { UserDBInterface, UserDBReader } from './userDB';
import { CourseDBInterface, CoursesDBInterface } from './courseDB';
import { ClassroomDBInterface } from './classroomDB';
import { AdminDBInterface } from './adminDB';

/**
 * Main factory interface for data access
 */
export interface DataLayerProvider {
  /**
   * Get the user database interface
   */
  getUserDB(): UserDBInterface;

  /**
   * Create a UserDBReader for a specific user (admin access required)
   * Uses session authentication to verify requesting user is admin
   * @param targetUsername - The username to create a reader for
   * @throws Error if requesting user is not 'admin'
   */
  createUserReaderForUser(targetUsername: string): Promise<UserDBReader>;

  /**
   * Get a course database interface
   */
  getCourseDB(courseId: string): CourseDBInterface;

  /**
   * Get the courses-lookup interface
   */
  getCoursesDB(): CoursesDBInterface;

  /**
   * Get a classroom database interface
   */
  getClassroomDB(classId: string, type: 'student' | 'teacher'): Promise<ClassroomDBInterface>;

  /**
   * Get the admin database interface
   */
  getAdminDB(): AdminDBInterface;

  /**
   * Initialize the data layer
   */
  initialize(): Promise<void>;

  /**
   * Teardown the data layer
   */
  teardown(): Promise<void>;

  /**
   * Check if this data layer is read-only
   */
  isReadOnly(): boolean;

  /**
   * Trigger local replication of a course database.
   *
   * When a course opts in via `CourseConfig.localSync.enabled`, this method
   * replicates the remote course DB to a local PouchDB instance. Subsequent
   * `getCourseDB()` calls for that course will return a CourseDB that reads
   * from the local replica (fast, no network) and writes to the remote
   * (ELO updates, admin ops).
   *
   * Safe to call multiple times — concurrent calls coalesce. Returns when
   * sync is complete (or immediately if already synced / disabled).
   *
   * Implementations that don't support local sync may no-op.
   *
   * @param courseId - The course to sync locally
   * @param forceEnabled - Skip CourseConfig check and sync regardless.
   *   Use when the caller already knows local sync is desired.
   */
  ensureCourseSynced?(courseId: string, forceEnabled?: boolean): Promise<void>;
}
