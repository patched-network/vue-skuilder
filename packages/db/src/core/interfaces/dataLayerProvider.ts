// db/src/core/interfaces.ts

import { UserDBInterface } from './userDB';
import { CourseDBInterface } from './courseDB';
import { ClassroomDBInterface } from './classroomDB';
import { AdminDBInterface } from './adminDB';

/**
 * Main factory interface for data access
 */
export interface DataLayerProvider {
  /**
   * Get the user database interface
   */
  getUserDB(username: string): UserDBInterface;

  /**
   * Get a course database interface
   */
  getCourseDB(courseId: string): CourseDBInterface;

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
}
