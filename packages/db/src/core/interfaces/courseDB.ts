import { CourseConfig, CourseElo, DataShape } from '@vue-skuilder/common';
import { StudySessionNewItem, StudySessionItem } from './contentSource';
import { CardData, DisplayableData, TagStub, Tag } from '../types/types-legacy';

/**
 * Course content and management
 */
export interface CourseDBInterface {
  /**
   * Get course config
   */
  getCourseConfig(courseId: string): Promise<CourseConfig>;

  /**
   * Update course config
   */
  updateCourseConfig(courseId: string, config: CourseConfig): Promise<PouchDB.Core.Response>;

  /**
   * Get a list of all courses
   */
  getCourseList(): Promise<PouchDB.Core.AllDocsResponse<CourseConfig>>;

  /**
   * Get cards sorted by ELO rating
   */
  getCardsByELO(courseId: string, elo: number, limit?: number): Promise<string[]>;

  /**
   * Get ELO data for specific cards
   */
  getCardEloData(courseId: string, cardIds: string[]): Promise<CourseElo[]>;

  /**
   * Update card ELO rating
   */
  updateCardElo(courseId: string, cardId: string, elo: CourseElo): Promise<PouchDB.Core.Response>;

  /**
   * Get new cards for study
   */
  getNewCards(courseId: string, limit?: number): Promise<StudySessionNewItem[]>;

  /**
   * Get cards centered at a particular ELO rating
   */
  getCardsCenteredAtELO(
    courseId: string,
    options: { limit: number; elo: 'user' | 'random' | number },
    filter?: (id: string) => boolean
  ): Promise<StudySessionItem[]>;

  /**
   * Get card data
   */
  getCard(courseId: string, cardId: string): Promise<CardData>;

  /**
   * Get displayable data for a card
   */
  getCardDisplayableData(courseId: string, cardId: string): Promise<DisplayableData[]>;

  /**
   * Get tags for a card
   */
  getAppliedTags(courseId: string, cardId: string): Promise<PouchDB.Query.Response<TagStub>>;

  /**
   * Add a tag to a card
   */
  addTagToCard(
    courseId: string,
    cardId: string,
    tagId: string,
    updateELO?: boolean
  ): Promise<PouchDB.Core.Response>;

  /**
   * Remove a tag from a card
   */
  removeTagFromCard(
    courseId: string,
    cardId: string,
    tagId: string
  ): Promise<PouchDB.Core.Response>;

  /**
   * Create a new tag
   */
  createTag(courseId: string, tagName: string): Promise<PouchDB.Core.Response>;

  /**
   * Get a tag by name
   */
  getTag(courseId: string, tagName: string): Promise<Tag>;

  /**
   * Update a tag
   */
  updateTag(tag: Tag): Promise<PouchDB.Core.Response>;

  /**
   * Get all tag stubs for a course
   */
  getCourseTagStubs(courseId: string): Promise<PouchDB.Core.AllDocsResponse<Tag>>;

  /**
   * Add a note to the course
   */
  addNote(
    courseId: string,
    codeCourse: string,
    shape: DataShape,
    data: unknown,
    author: string,
    tags: string[],
    uploads?: { [key: string]: PouchDB.Core.FullAttachment },
    elo?: CourseElo
  ): Promise<PouchDB.Core.Response>;
}
