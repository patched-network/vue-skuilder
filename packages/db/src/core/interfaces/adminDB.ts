import { ClassroomConfig, CourseConfig } from '@vue-skuilder/common';

/**
 * Admin functionality
 */
export interface AdminDBInterface {
  /**
   * Get all users
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  getUsers(): Promise<PouchDB.Core.Document<{}>[]>;

  /**
   * Get all courses
   */
  getCourses(): Promise<CourseConfig[]>;

  /**
   * Remove a course
   */
  removeCourse(id: string): Promise<PouchDB.Core.Response>;

  /**
   * Get all classrooms
   */
  getClassrooms(): Promise<(ClassroomConfig & { _id: string })[]>;
}
