
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
  rootManifest: any; // The parsed root skuilder.json object
  rootManifestUrl: string; // The absolute URL where the root manifest was found
}

export class StaticDataLayerProvider implements DataLayerProvider {
  private config: StaticDataLayerConfig;
  private initialized: boolean = false;
  private courseUnpackers: Map<string, StaticDataUnpacker> = new Map();
  private manifests: Record<string, StaticCourseManifest> = {};

  constructor(config: Partial<StaticDataLayerConfig>) {
    this.config = {
      localStoragePrefix: config.localStoragePrefix || 'skuilder-static',
      rootManifest: config.rootManifest || { dependencies: {} },
      rootManifestUrl: config.rootManifestUrl || '/',
    };
  }

  private async resolveCourseDependencies(): Promise<void> {
    logger.info('[StaticDataLayerProvider] Starting course dependency resolution...');
    const rootManifest = this.config.rootManifest;

    for (const [courseName, courseUrl] of Object.entries(rootManifest.dependencies || {})) {
      try {
        logger.debug(`[StaticDataLayerProvider] Resolving dependency: ${courseName} from ${courseUrl}`);
        
        const courseManifestUrl = new URL(courseUrl as string, this.config.rootManifestUrl).href;
        const courseJsonResponse = await fetch(courseManifestUrl);
        if (!courseJsonResponse.ok) {
          throw new Error(`Failed to fetch course manifest for ${courseName}`);
        }
        const courseJson = await courseJsonResponse.json();

        if (courseJson.content && courseJson.content.manifest) {
          const baseUrl = new URL('.', courseManifestUrl).href;
          const finalManifestUrl = new URL(courseJson.content.manifest, courseManifestUrl).href;

          const finalManifestResponse = await fetch(finalManifestUrl);
          if (!finalManifestResponse.ok) {
            throw new Error(`Failed to fetch final content manifest for ${courseName} at ${finalManifestUrl}`);
          }
          const finalManifest = await finalManifestResponse.json();
          
          this.manifests[courseName] = finalManifest;
          const unpacker = new StaticDataUnpacker(finalManifest, baseUrl);
          this.courseUnpackers.set(courseName, unpacker);

          logger.info(`[StaticDataLayerProvider] Successfully resolved and prepared course: ${courseName}`);
        }
      } catch (e) {
        logger.error(`[StaticDataLayerProvider] Failed to resolve dependency ${courseName}:`, e);
        // Continue to next dependency
      }
    }
    logger.info('[StaticDataLayerProvider] Course dependency resolution complete.');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing static data layer provider');
    await this.resolveCourseDependencies();
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
    const manifest = this.manifests[courseId];
    return new StaticCourseDB(courseId, unpacker, this.getUserDB(), manifest);
  }

  getCoursesDB(): CoursesDBInterface {
    return new StaticCoursesDB(this.manifests);
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
