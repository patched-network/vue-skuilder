// packages/db/src/impl/static/StaticDataLayerProvider.ts

import {
  AdminDBInterface,
  ClassroomDBInterface,
  CoursesDBInterface,
  CourseDBInterface,
  DataLayerProvider,
  UserDBInterface,
  CourseInfo,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '../../core/interfaces';
import { logger } from '../../util/logger';
import { StaticCourseManifest, StaticDataUnpacker } from './packer';
import { CourseConfig, CourseElo, DataShape, Status } from '@vue-skuilder/common';
import { Tag, TagStub, DocType, SkuilderCourseData } from '../../core/types/types-legacy';
import { DataLayerResult } from '../../core/types/db';
import { ContentNavigationStrategyData } from '../../core/types/contentNavigationStrategy';
import { ScheduledCard } from '../../core/types/user';
import { Navigators } from '../../core/navigators';

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
      staticContentPath: config.staticContentPath || '/static-content',
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
    return new StaticUserDB(this.config.localStoragePrefix!);
  }

  getCourseDB(courseId: string): CourseDBInterface {
    const unpacker = this.courseUnpackers.get(courseId);
    if (!unpacker) {
      throw new Error(`Course ${courseId} not found in static data`);
    }
    return new StaticCourseDB(courseId, unpacker, this.getUserDB());
  }

  getCoursesDB(): CoursesDBInterface {
    return new StaticCoursesDB(this.config.manifests);
  }

  async getClassroomDB(
    classId: string,
    type: 'student' | 'teacher'
  ): Promise<ClassroomDBInterface> {
    throw new Error('Classrooms not supported in static mode');
  }

  getAdminDB(): AdminDBInterface {
    throw new Error('Admin functions not supported in static mode');
  }
}

// Static implementation of CourseDB
class StaticCourseDB implements CourseDBInterface {
  constructor(
    private courseId: string,
    private unpacker: StaticDataUnpacker,
    private userDB: UserDBInterface
  ) {}

  getCourseID(): string {
    return this.courseId;
  }

  async getCourseConfig(): Promise<CourseConfig> {
    return this.unpacker.getDocument('CourseConfig');
  }

  async updateCourseConfig(cfg: CourseConfig): Promise<PouchDB.Core.Response> {
    throw new Error('Cannot update course config in static mode');
  }

  async getCourseInfo(): Promise<CourseInfo> {
    // This would need to be pre-computed in the manifest
    return {
      cardCount: 0, // Would come from manifest
      registeredUsers: 0,
    };
  }

  async getCourseDoc<T extends SkuilderCourseData>(
    id: string,
    options?: PouchDB.Core.GetOptions
  ): Promise<T> {
    return this.unpacker.getDocument(id);
  }

  async getCourseDocs<T extends SkuilderCourseData>(
    ids: string[],
    options?: PouchDB.Core.AllDocsOptions
  ): Promise<PouchDB.Core.AllDocsWithKeysResponse<{} & T>> {
    const rows = await Promise.all(
      ids.map(async (id) => {
        try {
          const doc = await this.unpacker.getDocument(id);
          return {
            id,
            key: id,
            value: { rev: '1-static' },
            doc,
          };
        } catch (error) {
          return {
            key: id,
            error: 'not_found' as const,
          };
        }
      })
    );

    return {
      total_rows: ids.length,
      offset: 0,
      rows,
    };
  }

  async getCardsByELO(elo: number, limit?: number): Promise<string[]> {
    return this.unpacker.queryByElo(elo, limit || 25);
  }

  async getCardEloData(cardIds: string[]): Promise<CourseElo[]> {
    const results = await Promise.all(
      cardIds.map(async (id) => {
        try {
          const card = await this.unpacker.getDocument(id);
          return card.elo || { global: { score: 1000, count: 0 }, tags: {}, misc: {} };
        } catch {
          return { global: { score: 1000, count: 0 }, tags: {}, misc: {} };
        }
      })
    );
    return results;
  }

  async updateCardElo(cardId: string, elo: CourseElo): Promise<PouchDB.Core.Response> {
    // In static mode, ELO updates would be stored locally
    logger.warn('Card ELO updates are stored locally only in static mode');
    return { ok: true, id: cardId, rev: '1-static' };
  }

  async getNewCards(limit?: number): Promise<StudySessionNewItem[]> {
    // Simplified implementation - would need proper navigation strategy
    const cardIds = await this.unpacker.queryByElo(1000, limit || 10);
    return cardIds.map((cardId) => ({
      status: 'new' as const,
      qualifiedID: `${this.courseId}-${cardId}`,
      cardID: cardId,
      contentSourceType: 'course' as const,
      contentSourceID: this.courseId,
      courseID: this.courseId,
    }));
  }

  async getCardsCenteredAtELO(
    options: { limit: number; elo: 'user' | 'random' | number },
    filter?: (id: string) => boolean
  ): Promise<StudySessionNewItem[]> {
    let targetElo = typeof options.elo === 'number' ? options.elo : 1000;

    if (options.elo === 'user') {
      // Get user's ELO for this course
      try {
        const regDoc = await this.userDB.getCourseRegistrationsDoc();
        const courseReg = regDoc.courses.find((c) => c.courseID === this.courseId);
        if (courseReg && typeof courseReg.elo === 'object') {
          targetElo = courseReg.elo.global.score;
        }
      } catch {
        targetElo = 1000;
      }
    } else if (options.elo === 'random') {
      targetElo = 800 + Math.random() * 400; // Random between 800-1200
    }

    let cardIds = await this.unpacker.queryByElo(targetElo, options.limit * 2);

    if (filter) {
      cardIds = cardIds.filter(filter);
    }

    return cardIds.slice(0, options.limit).map((cardId) => ({
      status: 'new' as const,
      qualifiedID: `${this.courseId}-${cardId}`,
      cardID: cardId,
      contentSourceType: 'course' as const,
      contentSourceID: this.courseId,
      courseID: this.courseId,
    }));
  }

  async getAppliedTags(cardId: string): Promise<PouchDB.Query.Response<TagStub>> {
    // Would need to query the tag index
    return {
      total_rows: 0,
      offset: 0,
      rows: [],
    };
  }

  async addTagToCard(cardId: string, tagId: string): Promise<PouchDB.Core.Response> {
    throw new Error('Cannot modify tags in static mode');
  }

  async removeTagFromCard(cardId: string, tagId: string): Promise<PouchDB.Core.Response> {
    throw new Error('Cannot modify tags in static mode');
  }

  async createTag(tagName: string): Promise<PouchDB.Core.Response> {
    throw new Error('Cannot create tags in static mode');
  }

  async getTag(tagName: string): Promise<Tag> {
    return this.unpacker.getDocument(`${DocType.TAG}-${tagName}`);
  }

  async updateTag(tag: Tag): Promise<PouchDB.Core.Response> {
    throw new Error('Cannot update tags in static mode');
  }

  async getCourseTagStubs(): Promise<PouchDB.Core.AllDocsResponse<Tag>> {
    // Would query all tag documents
    return {
      total_rows: 0,
      offset: 0,
      rows: [],
    };
  }

  async addNote(
    codeCourse: string,
    shape: DataShape,
    data: unknown,
    author: string,
    tags: string[],
    uploads?: { [key: string]: PouchDB.Core.FullAttachment },
    elo?: CourseElo
  ): Promise<DataLayerResult> {
    return {
      status: Status.error,
      message: 'Cannot add notes in static mode',
    };
  }

  async removeCard(cardId: string): Promise<PouchDB.Core.Response> {
    throw new Error('Cannot remove cards in static mode');
  }

  async getInexperiencedCards(): Promise<any[]> {
    // Would need to be pre-computed in indices
    return [];
  }

  // Navigation Strategy Manager implementation
  async getNavigationStrategy(id: string): Promise<ContentNavigationStrategyData> {
    return {
      id: 'ELO',
      docType: DocType.NAVIGATION_STRATEGY,
      name: 'ELO',
      description: 'ELO-based navigation strategy',
      implementingClass: Navigators.ELO,
      course: this.courseId,
      serializedData: '',
    };
  }

  async getAllNavigationStrategies(): Promise<ContentNavigationStrategyData[]> {
    return [await this.getNavigationStrategy('ELO')];
  }

  async addNavigationStrategy(data: ContentNavigationStrategyData): Promise<void> {
    throw new Error('Cannot add navigation strategies in static mode');
  }

  async updateNavigationStrategy(id: string, data: ContentNavigationStrategyData): Promise<void> {
    throw new Error('Cannot update navigation strategies in static mode');
  }

  async surfaceNavigationStrategy(): Promise<ContentNavigationStrategyData> {
    return this.getNavigationStrategy('ELO');
  }

  // Study Content Source implementation
  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    // In static mode, reviews would be stored locally
    return [];
  }
}

// Simplified static user DB using localStorage
class StaticUserDB implements UserDBInterface {
  constructor(private prefix: string) {}

  isLoggedIn(): boolean {
    return false; // Always guest in static mode
  }

  getUsername(): string {
    return 'Guest';
  }

  // Implement other required methods...
  // Most would use localStorage for persistence
  // This is a stub - full implementation would be needed

  async createAccount(username: string, password: string): Promise<any> {
    throw new Error('Cannot create accounts in static mode');
  }

  async login(username: string, password: string): Promise<any> {
    throw new Error('Cannot login in static mode');
  }

  async logout(): Promise<any> {
    return { ok: true };
  }

  // ... other methods would follow similar patterns
}

// Static implementation of CoursesDB
class StaticCoursesDB implements CoursesDBInterface {
  constructor(private manifests: Record<string, StaticCourseManifest>) {}

  async getCourseConfig(courseId: string): Promise<CourseConfig> {
    if (!this.manifests[courseId]) {
      throw new Error(`Course ${courseId} not found`);
    }

    // Would need to fetch the course config from static files
    return {} as CourseConfig;
  }

  async getCourseList(): Promise<CourseConfig[]> {
    // Return configs for all available courses
    return Object.keys(this.manifests).map(
      (courseId) =>
        ({
          courseID: courseId,
          name: this.manifests[courseId].courseName,
          // ... other config fields
        }) as CourseConfig
    );
  }

  async disambiguateCourse(courseId: string, disambiguator: string): Promise<void> {
    logger.warn('Cannot disambiguate courses in static mode');
  }
}
