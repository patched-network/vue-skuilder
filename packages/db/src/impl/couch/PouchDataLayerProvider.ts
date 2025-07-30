// db/src/impl/couch/PouchDataLayerProvider.ts

import {
  AdminDBInterface,
  ClassroomDBInterface,
  CoursesDBInterface,
  CourseDBInterface,
  DataLayerProvider,
  UserDBInterface,
  UserDBReader,
} from '../../core/interfaces';
import { logger } from '../../util/logger';
import { initializeDataDirectory } from '../../util/dataDirectory';

import { getLoggedInUsername } from './auth';

import { AdminDB } from './adminDB';
import { StudentClassroomDB, TeacherClassroomDB } from './classroomDB';
import { CourseDB, CoursesDB } from './courseDB';

import { BaseUser } from '../common';
import { CouchDBSyncStrategy } from './CouchDBSyncStrategy';

export class CouchDataLayerProvider implements DataLayerProvider {
  private initialized: boolean = false;
  private userDB!: UserDBInterface;
  private currentUsername: string = '';

  // the scoped list of courseIDs for a UI focused on a specific course
  // or group of courses
  private _courseIDs: string[] = [];

  constructor(coursIDs?: string[]) {
    if (coursIDs) {
      this._courseIDs = coursIDs;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Check if we are in a Node.js environment
    const isNodeEnvironment =
      typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

    if (isNodeEnvironment) {
      logger.info(
        'CouchDataLayerProvider: Running in Node.js environment, creating guest UserDB for testing.'
      );
      await initializeDataDirectory();
      // In Node.js (testing) environment, create a guest user instance
      const syncStrategy = new CouchDBSyncStrategy();
      this.userDB = await BaseUser.instance(syncStrategy);
    } else {
      // Assume browser-like environment, proceed with user session logic
      try {
        // Get the current username from session
        this.currentUsername = await getLoggedInUsername();
        logger.debug(`Current username: ${this.currentUsername}`);

        // Create the user db instance if a username was found
        if (this.currentUsername) {
          const syncStrategy = new CouchDBSyncStrategy();
          this.userDB = await BaseUser.instance(syncStrategy, this.currentUsername);
        } else {
          logger.warn('CouchDataLayerProvider: No logged-in username found in session.');
        }
      } catch (error) {
        logger.error(
          'CouchDataLayerProvider: Error during user session check or user DB initialization:',
          error
        );
      }
    }

    this.initialized = true;
  }

  async teardown(): Promise<void> {
    // Close connections, etc.
    this.initialized = false;
  }

  getUserDB(): UserDBInterface {
    return this.userDB;
  }

  getCourseDB(courseId: string): CourseDBInterface {
    return new CourseDB(courseId, async () => this.getUserDB());
  }

  getCoursesDB(): CoursesDBInterface {
    return new CoursesDB(this._courseIDs);
  }

  async getClassroomDB(
    classId: string,
    type: 'student' | 'teacher'
  ): Promise<ClassroomDBInterface> {
    if (type === 'student') {
      return await StudentClassroomDB.factory(classId, this.getUserDB());
    } else {
      return await TeacherClassroomDB.factory(classId);
    }
  }

  getAdminDB(): AdminDBInterface {
    return new AdminDB();
  }

  async createUserReaderForUser(targetUsername: string): Promise<UserDBReader> {
    // Security check: only admin can access other users' data
    const requestingUsername = await getLoggedInUsername();
    if (requestingUsername !== 'admin') {
      throw new Error('Unauthorized: Only admin users can access other users\' data');
    }

    logger.info(`Admin user '${requestingUsername}' requesting UserDBReader for '${targetUsername}'`);

    // Create a new sync strategy for the target user
    const syncStrategy = new CouchDBSyncStrategy();
    
    // Create a BaseUser instance for the target user
    // Note: This creates a read-capable user instance without affecting the current session
    const targetUserDB = await BaseUser.instance(syncStrategy, targetUsername);
    
    // Return as UserDBReader (which BaseUser implements since UserDBInterface extends UserDBReader)
    return targetUserDB as UserDBReader;
  }

  isReadOnly(): boolean {
    return false;
  }
}
