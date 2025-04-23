// db/src/impl/pouch/PouchDataLayerProvider.ts

import {
  AdminDBInterface,
  ClassroomDBInterface,
  CoursesDBInterface,
  CourseDBInterface,
  DataLayerProvider,
  UserDBInterface,
} from '../../core/interfaces';

import { getLoggedInUsername } from './auth';

import { AdminDB } from './adminDB';
import { StudentClassroomDB, TeacherClassroomDB } from './classroomDB';
import { CourseDB, CoursesDB } from './courseDB';

import { User } from './userDB';

export class PouchDataLayerProvider implements DataLayerProvider {
  private initialized: boolean = false;
  private userDB!: UserDBInterface;
  private currentUsername: string = '';

  constructor() {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Check if we are in a Node.js environment
    const isNodeEnvironment =
      typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

    if (isNodeEnvironment) {
      console.log(
        'PouchDataLayerProvider: Running in Node.js environment, skipping user session check and user DB initialization.'
      );
    } else {
      // Assume browser-like environment, proceed with user session logic
      try {
        // Get the current username from session
        this.currentUsername = await getLoggedInUsername();

        // Create the user db instance if a username was found
        if (this.currentUsername) {
          this.userDB = await User.instance(this.currentUsername);
        } else {
          console.warn('PouchDataLayerProvider: No logged-in username found in session.');
        }
      } catch (error) {
        console.error(
          'PouchDataLayerProvider: Error during user session check or user DB initialization:',
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
    return new CoursesDB();
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
}
