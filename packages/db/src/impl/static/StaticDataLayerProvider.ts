// packages/db/src/impl/static/StaticDataLayerProvider.ts

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
import { StaticCourseManifest } from '../../util/packer/types';
import { StaticDataUnpacker } from './StaticDataUnpacker';
import { StaticCourseDB } from './courseDB';
import { StaticCoursesDB } from './coursesDB';
import { BaseUser } from '../common';
import { NoOpSyncStrategy } from './NoOpSyncStrategy';

interface StaticDataLayerConfig {
  localStoragePrefix?: string;
  manifests: Record<string, StaticCourseManifest>; // courseId -> manifest
  courseLocations: Record<string, string>; // courseId -> baseUrl
}

export class StaticDataLayerProvider implements DataLayerProvider {
  private config: StaticDataLayerConfig;
  private initialized: boolean = false;
  private courseUnpackers: Map<string, StaticDataUnpacker> = new Map();

  constructor(config: Partial<StaticDataLayerConfig>) {
    this.config = {
      localStoragePrefix: config.localStoragePrefix || 'skuilder-static',
      manifests: config.manifests || {},
      courseLocations: config.courseLocations || {},
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing static data layer provider');

    // Load manifests for all courses
    for (const [courseId, manifest] of Object.entries(this.config.manifests)) {
      const baseUrl = this.config.courseLocations[courseId];
      if (!baseUrl) {
        logger.warn(`[StaticDataLayerProvider] No base URL found for course ${courseId}, skipping unpacker creation.`);
        continue;
      }
      const unpacker = new StaticDataUnpacker(manifest, baseUrl);
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
      throw new Error(`Course ${courseId} not found or failed to initialize in static data layer.`);
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

  async createUserReaderForUser(targetUsername: string): Promise<UserDBReader> {
    logger.warn(`StaticDataLayerProvider: Multi-user access not supported in static mode`);
    logger.warn(`Request: trying to access data for ${targetUsername}`);
    logger.warn(`Returning current user's data instead`);
    
    // In static mode, just return the current user's DB as a reader
    // This is safe since static mode is typically for development/testing
    return this.getUserDB() as UserDBReader;
  }

  isReadOnly(): boolean {
    return true;
  }
}