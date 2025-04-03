import { ClassroomConfig } from '@vue-skuilder/common';

/**
 * Admin functionality
 */
export interface AdminDBInterface {
  /**
   * Get all users
   */
  getUsers(): Promise<PouchDB.Core.Document<{}>[]>;

  /**
   * Get all courses
   */
  getCourses(): Promise<PouchDB.Core.Document<{}>[]>;

  /**
   * Remove a course
   */
  removeCourse(id: string): Promise<PouchDB.Core.Response>;

  /**
   * Get all classrooms
   */
  getClassrooms(): Promise<(ClassroomConfig & { _id: string })[]>;
}
