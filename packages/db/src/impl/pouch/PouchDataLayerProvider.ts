// db/src/impl/pouch/PouchDataLayerProvider.ts

import {
  DataLayerProvider,
  UserDBInterface,
  CourseDBInterface,
  ClassroomDBInterface,
  AdminDBInterface,
} from '../../core/interfaces';
import { PouchUserDB } from './PouchUserDB';
import { PouchCourseDB } from './PouchCourseDB';
import { PouchClassroomDB } from './PouchClassroomDB';
import { PouchAdminDB } from './PouchAdminDB';
import { AdminDB } from './adminDB';

export class PouchDataLayerProvider implements DataLayerProvider {
  private initialized: boolean = false;

  constructor(private options?: any) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Any global PouchDB setup that might be needed
    // This could include registering plugins, etc.
    this.initialized = true;
  }

  async teardown(): Promise<void> {
    // Close connections, etc.
    this.initialized = false;
  }

  getUserDB(username: string): UserDBInterface {
    return new PouchUserDB(username);
  }

  getCourseDB(courseId: string): CourseDBInterface {
    return new PouchCourseDB(courseId);
  }

  getClassroomDB(classId: string, type: 'student' | 'teacher'): ClassroomDBInterface {
    return new PouchClassroomDB(classId, type);
  }

  async getAdminDB(): Promise<AdminDBInterface> {
    return AdminDB.factory() as unknown as AdminDBInterface;
  }
}
