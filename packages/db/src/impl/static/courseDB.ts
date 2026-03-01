// packages/db/src/impl/static/courseDB.ts

import {
  CourseDBInterface,
  UserDBInterface,
  CourseInfo,
  StudySessionItem,
} from '../../core/interfaces';
import { StaticDataUnpacker } from './StaticDataUnpacker';
import { StaticCourseManifest } from '../../util/packer/types';
import { CourseConfig, CourseElo, DataShape, Status } from '@vue-skuilder/common';
import {
  Tag,
  TagStub,
  DocType,
  SkuilderCourseData,
  QualifiedCardID,
  DocTypePrefixes,
} from '../../core/types/types-legacy';
import { DataLayerResult } from '../../core/types/db';
import { ContentNavigationStrategyData } from '../../core/types/contentNavigationStrategy';

import { ContentNavigator, WeightedCard } from '../../core/navigators';
import { logger } from '../../util/logger';
import { createDefaultPipeline } from '@db/core/navigators/defaults';
import { PipelineAssembler } from '@db/core/navigators/PipelineAssembler';

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
    // Count only cards, not all documents
    // Use chunks metadata to count card documents specifically
    const cardCount = this.manifest.chunks
      .filter((chunk) => chunk.docType === DocType.CARD)
      .reduce((total, chunk) => total + chunk.documentCount, 0);

    return {
      cardCount,
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

  async getCardsByELO(
    elo: number,
    limit?: number
  ): Promise<
    {
      courseID: string;
      cardID: string;
      elo?: number;
    }[]
  > {
    return (await this.unpacker.queryByElo(elo, limit || 25)).map((card) => {
      const [courseID, cardID, elo] = card.split('-');
      return { courseID, cardID, elo: elo ? parseInt(elo) : undefined };
    });
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

  async getCardsCenteredAtELO(
    options: { limit: number; elo: 'user' | 'random' | number },
    filter?: (id: QualifiedCardID) => boolean
  ): Promise<StudySessionItem[]> {
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

    let cardIds = (await this.unpacker.queryByElo(targetElo, options.limit * 2)).map((c) => {
      return {
        cardID: c,
        courseID: this.courseId,
      };
    });

    if (filter) {
      cardIds = cardIds.filter(filter);
    }

    return cardIds.slice(0, options.limit).map((card) => ({
      status: 'new' as const,
      // qualifiedID: `${this.courseId}-${cardId}`,
      cardID: card.cardID,
      contentSourceType: 'course' as const,
      contentSourceID: this.courseId,
      courseID: this.courseId,
    }));
  }

  async getAppliedTags(cardId: string): Promise<PouchDB.Query.Response<TagStub>> {
    try {
      const tagsIndex = await this.unpacker.getTagsIndex();
      const cardTags = tagsIndex.byCard[cardId] || [];

      const rows = await Promise.all(
        cardTags.map(async (tagName) => {
          const tagId = `${DocType.TAG}-${tagName}`;

          try {
            // Try to get the full tag document
            const tagDoc = await this.unpacker.getDocument(tagId);
            return {
              id: tagId,
              key: cardId,
              value: {
                name: tagDoc.name,
                snippet: tagDoc.snippet,
                count: tagDoc.taggedCards?.length || 0,
              },
            };
          } catch (error) {
            if (error && (error as PouchDB.Core.Error).status === 404) {
              logger.warn(`Tag document not found for ${tagName}, creating stub`);
            } else {
              logger.error(`Error getting tag document for ${tagName}:`, error);
              throw error;
            }
            // If tag document not found, create a minimal stub
            return {
              id: tagId,
              key: cardId,
              value: {
                name: tagName,
                snippet: `Tag: ${tagName}`,
                count: tagsIndex.byTag[tagName]?.length || 0,
              },
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
      logger.error(`Error getting applied tags for card ${cardId}:`, error);
      return {
        total_rows: 0,
        offset: 0,
        rows: [],
      };
    }
  }

  async getAppliedTagsBatch(cardIds: string[]): Promise<Map<string, string[]>> {
    const tagsIndex = await this.unpacker.getTagsIndex();
    const tagsByCard = new Map<string, string[]>();

    for (const cardId of cardIds) {
      tagsByCard.set(cardId, tagsIndex.byCard[cardId] || []);
    }

    return tagsByCard;
  }

  async getAllCardIds(): Promise<string[]> {
    const tagsIndex = await this.unpacker.getTagsIndex();
    return Object.keys(tagsIndex.byCard);
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
            if (error && (error as PouchDB.Core.Error).status === 404) {
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
            } else {
              logger.error(`Error getting tag document for ${tagName}:`, error);
              throw error;
            }
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
  async getNavigationStrategy(id: string): Promise<ContentNavigationStrategyData> {
    try {
      return await this.unpacker.getDocument(id);
    } catch (error) {
      logger.error(`[static/courseDB] Strategy ${id} not found: ${error}`);
      throw error;
    }
  }

  async getAllNavigationStrategies(): Promise<ContentNavigationStrategyData[]> {
    const prefix = DocTypePrefixes[DocType.NAVIGATION_STRATEGY];
    try {
      const docs = await this.unpacker.getAllDocumentsByPrefix(prefix);
      return docs as ContentNavigationStrategyData[];
    } catch (error) {
      logger.warn(`[static/courseDB] Error loading navigation strategies: ${error}`);
      return []; // Fall back to default pipeline
    }
  }

  async addNavigationStrategy(_data: ContentNavigationStrategyData): Promise<void> {
    throw new Error('Cannot add navigation strategies in static mode');
  }

  async updateNavigationStrategy(_id: string, _data: ContentNavigationStrategyData): Promise<void> {
    throw new Error('Cannot update navigation strategies in static mode');
  }

  /**
   * Create a ContentNavigator for this course.
   *
   * Loads navigation strategy documents from static data and uses PipelineAssembler
   * to build a Pipeline. Falls back to default pipeline if no strategies found.
   */
  async createNavigator(user: UserDBInterface): Promise<ContentNavigator> {
    try {
      const allStrategies = await this.getAllNavigationStrategies();

      if (allStrategies.length === 0) {
        logger.debug(
          '[static/courseDB] No strategy documents found, using default Pipeline(Composite(ELO, SRS), [eloDistanceFilter])'
        );
        return createDefaultPipeline(user, this);
      }

      // Use PipelineAssembler to build Pipeline from strategy documents
      const assembler = new PipelineAssembler();
      const { pipeline, generatorStrategies, filterStrategies, warnings } =
        await assembler.assemble({
          strategies: allStrategies,
          user,
          course: this,
        });

      // Log warnings
      for (const warning of warnings) {
        logger.warn(`[PipelineAssembler] ${warning}`);
      }

      if (!pipeline) {
        logger.debug('[static/courseDB] Pipeline assembly failed, using default pipeline');
        return createDefaultPipeline(user, this);
      }

      logger.debug(
        `[static/courseDB] Using assembled pipeline with ${generatorStrategies.length} generator(s) and ${filterStrategies.length} filter(s)`
      );
      return pipeline;
    } catch (e) {
      logger.error(`[static/courseDB] Error creating navigator: ${e}`);
      throw e;
    }
  }

  // Study Content Source implementation

  private _pendingHints: Record<string, unknown> | null = null;

  setEphemeralHints(hints: Record<string, unknown>): void {
    this._pendingHints = hints;
  }

  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    try {
      const navigator = await this.createNavigator(this.userDB);
      // Forward any pending hints to the Pipeline
      if (this._pendingHints) {
        navigator.setEphemeralHints(this._pendingHints);
        this._pendingHints = null;
      }
      return navigator.getWeightedCards(limit);
    } catch (e) {
      logger.error(`[static/courseDB] Error getting weighted cards: ${e}`);
      throw e;
    }
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

  // Admin search methods
  async searchCards(_query: string): Promise<any[]> {
    // In static mode, return empty results for now
    // Could be implemented with local search if needed
    return [];
  }

  async find(_request: PouchDB.Find.FindRequest<any>): Promise<PouchDB.Find.FindResponse<any>> {
    // In static mode, return empty results for now
    // Could be implemented with local search if needed
    return {
      docs: [],
      warning: 'Find operations not supported in static mode',
    } as any;
  }
}
