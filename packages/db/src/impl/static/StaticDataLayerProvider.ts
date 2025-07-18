// packages/db/src/impl/static/StaticDataLayerProvider.ts

import {
  AdminDBInterface,
  ClassroomDBInterface,
  CoursesDBInterface,
  CourseDBInterface,
  DataLayerProvider,
  UserDBInterface,
} from '../../core/interfaces';
import { logger } from '../../util/logger';
import { StaticCourseManifest } from '../../util/packer/types';
import { StaticDataUnpacker } from './StaticDataUnpacker';
import { StaticCourseDB } from './courseDB';
import { StaticCoursesDB } from './coursesDB';
import { BaseUser } from '../common';
import { NoOpSyncStrategy } from './NoOpSyncStrategy';

interface StaticDataLayerConfig {
  staticContentPath: string;
  localStoragePrefix?: string;
  manifests: Record<string, StaticCourseManifest>; // courseId -> manifest
}

export class StaticDataLayerProvider implements DataLayerProvider {
  private config: StaticDataLayerConfig;
  private initialized: boolean = false;
  private courseUnpackers: Map<string, StaticDataUnpacker> = new Map();

  constructor(config: Partial<StaticDataLayerConfig>) {
    this.config = {
      staticContentPath: config.staticContentPath || '/static-courses',
      localStoragePrefix: config.localStoragePrefix || 'skuilder-static',
      manifests: config.manifests || {},
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing static data layer provider');

    // Load manifests for all courses
    for (const [courseId, manifest] of Object.entries(this.config.manifests)) {
      const unpacker = new StaticDataUnpacker(
        manifest,
        `${this.config.staticContentPath}/${courseId}`
      );
      this.courseUnpackers.set(courseId, unpacker);
    }

    this.initialized = true;
  }

  async teardown(): Promise<void> {
    this.courseUnpackers.clear();
    this.initialized = false;
  }

  getUserDB(): UserDBInterface {
    const syncStrategy = new NoOpSyncStrategy();
    // For now, use guest user - local account switching will be added later
    return BaseUser.Dummy(syncStrategy);
  }

  getCourseDB(courseId: string): CourseDBInterface {
    const unpacker = this.courseUnpackers.get(courseId);
    if (!unpacker) {
      throw new Error(`Course ${courseId} not found in static data`);
    }
    const manifest = this.config.manifests[courseId];
    return new StaticCourseDB(courseId, unpacker, this.getUserDB(), manifest);
  }

  getCoursesDB(): CoursesDBInterface {
    return new StaticCoursesDB(this.config.manifests);
  }

  async getClassroomDB(
    _classId: string,
    _type: 'student' | 'teacher'
  ): Promise<ClassroomDBInterface> {
    throw new Error('Classrooms not supported in static mode');
  }

  getAdminDB(): AdminDBInterface {
    throw new Error('Admin functions not supported in static mode');
  }

  isReadOnly(): boolean {
    return true;
  }
}
