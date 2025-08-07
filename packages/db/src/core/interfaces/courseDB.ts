import { CourseConfig, CourseElo, DataShape, SkuilderCourseData } from '@vue-skuilder/common';
import { StudySessionNewItem, StudySessionItem } from './contentSource';
import { TagStub, Tag } from '../types/types-legacy';
import { DataLayerResult } from '../types/db';
import { NavigationStrategyManager } from './navigationStrategyManager';

/**
 * Course content and management
 */
export interface CoursesDBInterface {
  /**
   * Get course config
   */
  getCourseConfig(courseId: string): Promise<CourseConfig>;

  /**
   * Get a list of all courses
   */
  getCourseList(): Promise<CourseConfig[]>;

  disambiguateCourse(courseId: string, disambiguator: string): Promise<void>;
}

export interface CourseInfo {
  cardCount: number;
  registeredUsers: number;
}

export interface CourseDBInterface extends NavigationStrategyManager {
  /**
   * Get course config
   */
  getCourseConfig(): Promise<CourseConfig>;

  getCourseID(): string;

  /**
   * Set course config
   */
  updateCourseConfig(cfg: CourseConfig): Promise<PouchDB.Core.Response>;

  getCourseInfo(): Promise<CourseInfo>;

  getCourseDoc<T extends SkuilderCourseData>(
    id: string,
    options?: PouchDB.Core.GetOptions
  ): Promise<T>;
  getCourseDocs<T extends SkuilderCourseData>(
    ids: string[],
    options?: PouchDB.Core.AllDocsOptions
  ): Promise<PouchDB.Core.AllDocsWithKeysResponse<{} & T>>;

  /**
   * Get cards sorted by ELO rating
   */
  getCardsByELO(
    elo: number,
    limit?: number
  ): Promise<
    {
      courseID: string;
      cardID: string;
      elo?: number;
    }[]
  >;

  /**
   * Get ELO data for specific cards
   */
  getCardEloData(cardIds: string[]): Promise<CourseElo[]>;

  /**
   * Update card ELO rating
   */
  updateCardElo(cardId: string, elo: CourseElo): Promise<PouchDB.Core.Response>;

  /**
   * Get new cards for study
   */
  getNewCards(limit?: number): Promise<StudySessionNewItem[]>;

  /**
   * Get cards centered at a particular ELO rating
   */
  getCardsCenteredAtELO(
    options: { limit: number; elo: 'user' | 'random' | number },
    filter?: (id: string) => boolean
  ): Promise<StudySessionItem[]>;

  /**
   * Get tags for a card
   */
  getAppliedTags(cardId: string): Promise<PouchDB.Query.Response<TagStub>>;

  /**
   * Add a tag to a card
   */
  addTagToCard(cardId: string, tagId: string, updateELO?: boolean): Promise<PouchDB.Core.Response>;

  /**
   * Remove a tag from a card
   */
  removeTagFromCard(cardId: string, tagId: string): Promise<PouchDB.Core.Response>;

  /**
   * Create a new tag
   */
  createTag(tagName: string, author: string): Promise<PouchDB.Core.Response>;

  /**
   * Get a tag by name
   */
  getTag(tagName: string): Promise<Tag>;

  /**
   * Update a tag
   */
  updateTag(tag: Tag): Promise<PouchDB.Core.Response>;

  /**
   * Get all tag stubs for a course
   */
  getCourseTagStubs(): Promise<PouchDB.Core.AllDocsResponse<Tag>>;

  /**
   * Add a note to the course
   */
  addNote(
    codeCourse: string,
    shape: DataShape,
    data: unknown,
    author: string,
    tags: string[],
    uploads?: { [key: string]: PouchDB.Core.FullAttachment },
    elo?: CourseElo
  ): Promise<DataLayerResult>;

  removeCard(cardId: string): Promise<PouchDB.Core.Response>;

  getInexperiencedCards(): Promise<
    {
      courseId: string;
      cardId: string;
      count: number;
      elo: CourseElo;
    }[]
  >;

  /**
   * Search for cards by text content
   * @param query Text to search for
   * @returns Array of matching card data
   */
  searchCards(query: string): Promise<any[]>;

  /**
   * Find documents using PouchDB query syntax
   * @param request PouchDB find request
   * @returns Query response
   */
  find(request: PouchDB.Find.FindRequest<any>): Promise<PouchDB.Find.FindResponse<any>>;
}
