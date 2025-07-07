// packages/db/src/impl/static/courseDB.ts

import {
  CourseDBInterface,
  UserDBInterface,
  CourseInfo,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '../../core/interfaces';
import { StaticDataUnpacker } from './StaticDataUnpacker';
import { StaticCourseManifest } from '../../util/packer/types';
import { CourseConfig, CourseElo, DataShape, Status } from '@vue-skuilder/common';
import { Tag, TagStub, DocType, SkuilderCourseData } from '../../core/types/types-legacy';
import { DataLayerResult } from '../../core/types/db';
import { ContentNavigationStrategyData } from '../../core/types/contentNavigationStrategy';
import { ScheduledCard } from '../../core/types/user';
import { Navigators } from '../../core/navigators';
import { logger } from '../../util/logger';

export class StaticCourseDB implements CourseDBInterface {
  constructor(
    private courseId: string,
    private unpacker: StaticDataUnpacker,
    private userDB: UserDBInterface,
    private manifest: StaticCourseManifest
  ) {}

  getCourseID(): string {
    return this.courseId;
  }

  async getCourseConfig(): Promise<CourseConfig> {
    if (this.manifest.courseConfig != null) {
      return this.manifest.courseConfig;
    } else {
      throw new Error(`Course config not found for course ${this.courseId}`);
    }
  }

  async updateCourseConfig(_cfg: CourseConfig): Promise<PouchDB.Core.Response> {
    throw new Error('Cannot update course config in static mode');
  }

  async getCourseInfo(): Promise<CourseInfo> {
    return {
      cardCount: this.manifest.documentCount || 0,
      registeredUsers: 0, // Always 0 in static mode
    };
  }

  async getCourseDoc<T extends SkuilderCourseData>(
    id: string,
    _options?: PouchDB.Core.GetOptions
  ): Promise<T> {
    return this.unpacker.getDocument(id);
  }

  async getCourseDocs<T extends SkuilderCourseData>(
    ids: string[],
    _options?: PouchDB.Core.AllDocsOptions
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
        } catch {
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

  async updateCardElo(cardId: string, _elo: CourseElo): Promise<PouchDB.Core.Response> {
    // No updates to card data in static mode - this is a noop
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

  async getAppliedTags(_cardId: string): Promise<PouchDB.Query.Response<TagStub>> {
    // Would need to query the tag index
    logger.warn(`getAppliedTags not implemented`);
    return {
      total_rows: 0,
      offset: 0,
      rows: [],
    };
  }

  async addTagToCard(_cardId: string, _tagId: string): Promise<PouchDB.Core.Response> {
    throw new Error('Cannot modify tags in static mode');
  }

  async removeTagFromCard(_cardId: string, _tagId: string): Promise<PouchDB.Core.Response> {
    throw new Error('Cannot modify tags in static mode');
  }

  async createTag(_tagName: string): Promise<PouchDB.Core.Response> {
    throw new Error('Cannot create tags in static mode');
  }

  async getTag(tagName: string): Promise<Tag> {
    return this.unpacker.getDocument(`${DocType.TAG}-${tagName}`);
  }

  async updateTag(_tag: Tag): Promise<PouchDB.Core.Response> {
    throw new Error('Cannot update tags in static mode');
  }

  async getCourseTagStubs(): Promise<PouchDB.Core.AllDocsResponse<Tag>> {
    try {
      const tagsIndex = await this.unpacker.getTagsIndex();
      
      if (!tagsIndex || !tagsIndex.byTag) {
        logger.warn('Tags index not found or empty');
        return {
          total_rows: 0,
          offset: 0,
          rows: [],
        };
      }

      // Create tag stubs from the index
      const tagNames = Object.keys(tagsIndex.byTag);
      const rows = await Promise.all(
        tagNames.map(async (tagName) => {
          const cardIds = tagsIndex.byTag[tagName] || [];
          const tagId = `${DocType.TAG}-${tagName}`;
          
          try {
            // Try to get the full tag document
            const tagDoc = await this.unpacker.getDocument(tagId);
            return {
              id: tagId,
              key: tagId,
              value: { rev: '1-static' },
              doc: tagDoc,
            };
          } catch (error) {
            // If tag document not found, create a minimal stub
            logger.warn(`Tag document not found for ${tagName}, creating stub`);
            const stubDoc = {
              _id: tagId,
              _rev: '1-static',
              course: this.courseId,
              docType: DocType.TAG,
              name: tagName,
              snippet: `Tag: ${tagName}`,
              wiki: '',
              taggedCards: cardIds,
              author: 'system',
            };
            return {
              id: tagId,
              key: tagId,
              value: { rev: '1-static' },
              doc: stubDoc,
            };
          }
        })
      );

      return {
        total_rows: rows.length,
        offset: 0,
        rows,
      };
    } catch (error) {
      logger.error('Failed to get course tag stubs:', error);
      return {
        total_rows: 0,
        offset: 0,
        rows: [],
      };
    }
  }

  async addNote(
    _codeCourse: string,
    _shape: DataShape,
    _data: unknown,
    _author: string,
    _tags: string[],
    _uploads?: { [key: string]: PouchDB.Core.FullAttachment },
    _elo?: CourseElo
  ): Promise<DataLayerResult> {
    return {
      status: Status.error,
      message: 'Cannot add notes in static mode',
    };
  }

  async removeCard(_cardId: string): Promise<PouchDB.Core.Response> {
    throw new Error('Cannot remove cards in static mode');
  }

  async getInexperiencedCards(): Promise<any[]> {
    // Would need to be pre-computed in indices
    return [];
  }

  // Navigation Strategy Manager implementation
  async getNavigationStrategy(_id: string): Promise<ContentNavigationStrategyData> {
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

  async addNavigationStrategy(_data: ContentNavigationStrategyData): Promise<void> {
    throw new Error('Cannot add navigation strategies in static mode');
  }

  async updateNavigationStrategy(_id: string, _data: ContentNavigationStrategyData): Promise<void> {
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

  // Attachment helper methods (internal use, not part of interface)

  /**
   * Get attachment URL for a document and attachment name
   * Internal helper method for static attachment serving
   */
  getAttachmentUrl(docId: string, attachmentName: string): string {
    return this.unpacker.getAttachmentUrl(docId, attachmentName);
  }

  /**
   * Load attachment as blob/buffer
   * Internal helper method for static attachment serving
   */
  async getAttachmentBlob(docId: string, attachmentName: string): Promise<Blob | Buffer | null> {
    return this.unpacker.getAttachmentBlob(docId, attachmentName);
  }
}
