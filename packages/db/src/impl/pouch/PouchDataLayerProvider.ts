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

import { AdminDB } from './adminDB';
import { StudentClassroomDB, TeacherClassroomDB } from './classroomDB';

export class PouchDataLayerProvider implements DataLayerProvider {
  private initialized: boolean = false;
  private currentUserName: string = '';

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

  async getClassroomDB(
    classId: string,
    type: 'student' | 'teacher'
  ): Promise<ClassroomDBInterface> {
    if (type === 'student') {
      return await StudentClassroomDB.factory(classId, this.getUserDB(this.currentUserName));
    } else {
      return await TeacherClassroomDB.factory(classId);
    }
  }

  getAdminDB(): AdminDBInterface {
    return new AdminDB();
  }
}
