
import {
  StudyContentSource,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '@db/core/interfaces/contentSource';
import { getTag, CourseDB } from '../impl/couch';
import { UserDBInterface } from '@db/core';
import { logger }from '@db/util/logger';
import { isReview } from '@db/impl/couch';

// Defines the structure for our boolean algebra of tags.
export interface TagFilter {
  include: string[]; // An array of tag names to be OR'd together.
  exclude: string[]; // An array of tag names to be AND NOT'd.
}

/**
 * A StudyContentSource that provides cards based on a boolean filter of tags.
 * This allows for creating study sessions focused on specific topics.
 */
export class TagFilteredContentSource implements StudyContentSource {
  private courseId: string;
  private filter: TagFilter;
  private user: UserDBInterface;
  private courseDB: CourseDB;

  constructor(courseId: string, filter: TagFilter, user: UserDBInterface) {
    this.courseId = courseId;
    this.filter = filter;
    this.user = user;
    // Note: The second argument to the CourseDB constructor is a function that returns a promise resolving to a UserDBInterface.
    this.courseDB = new CourseDB(this.courseId, () => Promise.resolve(this.user));
    logger.info(`[TagFilteredContentSource] Created for course "${courseId}" with filter:`, filter);
  }

  /**
   * Retrieves a set of card IDs that match the include/exclude filter.
   * This logic is central to both new card selection and review filtering.
   */
  private async resolveFilteredCardIds(): Promise<Set<string>> {
    const includedCardIds = new Set<string>();
    if (this.filter.include && this.filter.include.length > 0) {
      for (const tagName of this.filter.include) {
        try {
          const tagDoc = await getTag(this.courseId, tagName);
          tagDoc.taggedCards.forEach(cardId => includedCardIds.add(cardId));
        } catch (error) {
          logger.warn(`[TagFilteredContentSource] Could not resolve tag "${tagName}" for inclusion.`);
        }
      }
    }

    const excludedCardIds = new Set<string>();
    if (this.filter.exclude && this.filter.exclude.length > 0) {
      for (const tagName of this.filter.exclude) {
        try {
          const tagDoc = await getTag(this.courseId, tagName);
          tagDoc.taggedCards.forEach(cardId => excludedCardIds.add(cardId));
        } catch (error) {
          logger.warn(`[TagFilteredContentSource] Could not resolve tag "${tagName}" for exclusion.`);
        }
      }
    }

    const finalCardIds = new Set<string>();
    for (const id of includedCardIds) {
      if (!excludedCardIds.has(id)) {
        finalCardIds.add(id);
      }
    }

    return finalCardIds;
  }

  /**
   * Gets new cards that match the tag filter and are not already active for the user.
   */
  public async getNewCards(): Promise<StudySessionNewItem[]> {
    const finalCardIds = await this.resolveFilteredCardIds();
    const activeCards = await this.user.getActiveCards();
    const activeCardIds = new Set(activeCards.map(c => c.cardID));

    const newItems: StudySessionNewItem[] = [];
    for (const cardId of finalCardIds) {
      if (!activeCardIds.has(cardId)) {
        newItems.push({
          courseID: this.courseId,
          cardID: cardId,
          qualifiedID: `${this.courseId}-${cardId}`,
          contentSourceType: 'tag-filter',
          contentSourceID: this.courseId,
          status: 'new',
        });
      }
    }
    logger.info(`[TagFilteredContentSource] Found ${newItems.length} new cards matching filter.`);
    return newItems;
  }

  /**
   * Gets pending reviews, filtered to only include cards that match the tag filter.
   */
  public async getPendingReviews(): Promise<StudySessionReviewItem[]> {
    const allReviews = await this.user.getPendingReviews();
    const allowedCardIds = await this.resolveFilteredCardIds();

    const filteredReviews = allReviews.filter(review => {
      return review.courseId === this.courseId && allowedCardIds.has(review.cardId);
    });

    logger.info(`[TagFilteredContentSource] Found ${filteredReviews.length} pending reviews matching filter.`);
    return filteredReviews.map(r => ({
      ...r,
      qualifiedID: `${r.courseId}-${r.cardId}`,
      courseID: r.courseId,
      cardID: r.cardId,
      contentSourceType: 'tag-filter',
      contentSourceID: this.courseId,
      reviewID: r._id, // Ensure reviewID is present
      status: isReview(r) ? r.status : 'review',
    }));
  }
}
