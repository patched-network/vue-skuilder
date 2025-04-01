// db/src/impl/pouch/PouchDataLayerProvider.ts

import {
  AdminDBInterface,
  ClassroomDBInterface,
  CourseDBInterface,
  DataLayerProvider,
  UserDBInterface,
} from '../../core/interfaces';

import { AdminDB } from './adminDB';
import { StudentClassroomDB, TeacherClassroomDB } from './classroomDB';
import { CourseDB } from './courseDB';

export class PouchDataLayerProvider implements DataLayerProvider {
  private initialized: boolean = false;
  private userDB!: UserDBInterface;
  private userGetter: (() => Promise<UserDBInterface>) | null = null;

  constructor(private options?: any) {
    if (options && options.userGetter) {
      this.userGetter = options.userGetter;
    }
    this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.userGetter) {
      throw new Error('User getter is not provided');
    } else {
      this.userDB = await this.userGetter();
    }

    // Any global PouchDB setup that might be needed
    // This could include registering plugins, etc.
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
