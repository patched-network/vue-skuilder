import {
  StudyContentSource,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '@db/core/interfaces/contentSource';
import { WeightedCard } from '@db/core/navigators';
import { UserDBInterface } from '@db/core';
import { ScheduledCard } from '@db/core/types/user';
import { TagFilter, hasActiveFilter } from '@vue-skuilder/common';
import { getTag } from '../impl/couch/courseDB';
import { logger } from '@db/util/logger';

/**
 * A StudyContentSource that filters cards based on tag inclusion/exclusion.
 *
 * This enables ephemeral, tag-scoped study sessions where users can focus
 * on specific topics within a course without permanent configuration.
 *
 * Filter logic:
 * - If `include` is non-empty: card must have at least one of the included tags
 * - If `exclude` is non-empty: card must not have any of the excluded tags
 * - Both filters are applied (include first, then exclude)
 */
export class TagFilteredContentSource implements StudyContentSource {
  private courseId: string;
  private filter: TagFilter;
  private user: UserDBInterface;

  // Cache resolved card IDs to avoid repeated lookups within a session
  private resolvedCardIds: Set<string> | null = null;

  constructor(courseId: string, filter: TagFilter, user: UserDBInterface) {
    this.courseId = courseId;
    this.filter = filter;
    this.user = user;

    logger.info(
      `[TagFilteredContentSource] Created for course "${courseId}" with filter:`,
      JSON.stringify(filter)
    );
  }

  /**
   * Resolves the TagFilter to a set of eligible card IDs.
   *
   * - Cards in `include` tags are OR'd together (card needs at least one)
   * - Cards in `exclude` tags are removed from the result
   */
  private async resolveFilteredCardIds(): Promise<Set<string>> {
    // Return cached result if available
    if (this.resolvedCardIds !== null) {
      return this.resolvedCardIds;
    }

    const includedCardIds = new Set<string>();

    // Build inclusion set (OR of all include tags)
    if (this.filter.include.length > 0) {
      for (const tagName of this.filter.include) {
        try {
          const tagDoc = await getTag(this.courseId, tagName);
          tagDoc.taggedCards.forEach((cardId) => includedCardIds.add(cardId));
        } catch (error) {
          logger.warn(
            `[TagFilteredContentSource] Could not resolve tag "${tagName}" for inclusion:`,
            error
          );
        }
      }
    }

    // If no include tags specified or none resolved, return empty set
    // (requiring explicit inclusion prevents "study everything" on empty filter)
    if (includedCardIds.size === 0 && this.filter.include.length > 0) {
      logger.warn(
        `[TagFilteredContentSource] No cards found for include tags: ${this.filter.include.join(', ')}`
      );
      this.resolvedCardIds = new Set();
      return this.resolvedCardIds;
    }

    // Build exclusion set
    const excludedCardIds = new Set<string>();
    if (this.filter.exclude.length > 0) {
      for (const tagName of this.filter.exclude) {
        try {
          const tagDoc = await getTag(this.courseId, tagName);
          tagDoc.taggedCards.forEach((cardId) => excludedCardIds.add(cardId));
        } catch (error) {
          logger.warn(
            `[TagFilteredContentSource] Could not resolve tag "${tagName}" for exclusion:`,
            error
          );
        }
      }
    }

    // Apply exclusion filter
    const finalCardIds = new Set<string>();
    for (const cardId of includedCardIds) {
      if (!excludedCardIds.has(cardId)) {
        finalCardIds.add(cardId);
      }
    }

    logger.info(
      `[TagFilteredContentSource] Resolved ${finalCardIds.size} cards ` +
        `(included: ${includedCardIds.size}, excluded: ${excludedCardIds.size})`
    );

    this.resolvedCardIds = finalCardIds;
    return finalCardIds;
  }

  /**
   * Gets new cards that match the tag filter and are not already active for the user.
   */
  public async getNewCards(limit?: number): Promise<StudySessionNewItem[]> {
    if (!hasActiveFilter(this.filter)) {
      logger.warn('[TagFilteredContentSource] getNewCards called with no active filter');
      return [];
    }

    const eligibleCardIds = await this.resolveFilteredCardIds();
    const activeCards = await this.user.getActiveCards();
    const activeCardIds = new Set(activeCards.map((c) => c.cardID));

    const newItems: StudySessionNewItem[] = [];
    for (const cardId of eligibleCardIds) {
      if (!activeCardIds.has(cardId)) {
        newItems.push({
          courseID: this.courseId,
          cardID: cardId,
          contentSourceType: 'course',
          contentSourceID: this.courseId,
          status: 'new',
        });
      }

      if (limit !== undefined && newItems.length >= limit) {
        break;
      }
    }

    logger.info(`[TagFilteredContentSource] Found ${newItems.length} new cards matching filter`);
    return newItems;
  }

  /**
   * Gets pending reviews, filtered to only include cards that match the tag filter.
   */
  public async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    if (!hasActiveFilter(this.filter)) {
      logger.warn('[TagFilteredContentSource] getPendingReviews called with no active filter');
      return [];
    }

    const eligibleCardIds = await this.resolveFilteredCardIds();
    const allReviews = await this.user.getPendingReviews(this.courseId);

    const filteredReviews = allReviews.filter((review) => {
      return eligibleCardIds.has(review.cardId);
    });

    logger.info(
      `[TagFilteredContentSource] Found ${filteredReviews.length} pending reviews matching filter ` +
        `(of ${allReviews.length} total)`
    );

    return filteredReviews.map((r) => ({
      ...r,
      courseID: r.courseId,
      cardID: r.cardId,
      contentSourceType: 'course' as const,
      contentSourceID: this.courseId,
      reviewID: r._id,
      status: 'review' as const,
    }));
  }

  /**
   * Get cards with suitability scores for presentation.
   *
   * This implementation wraps the legacy getNewCards/getPendingReviews methods,
   * assigning score=1.0 to all cards. TagFilteredContentSource does not currently
   * support pluggable navigation strategies - it returns flat-scored candidates.
   *
   * @param limit - Maximum number of cards to return
   * @returns Cards sorted by score descending (all scores = 1.0)
   */
  public async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const [newCards, reviews] = await Promise.all([
      this.getNewCards(limit),
      this.getPendingReviews(),
    ]);

    const weighted: WeightedCard[] = [
      ...reviews.map((r) => ({
        cardId: r.cardID,
        courseId: r.courseID,
        score: 1.0,
        provenance: [
          {
            strategy: 'tagFilter',
            strategyName: 'Tag Filter',
            strategyId: 'TAG_FILTER',
            action: 'generated' as const,
            score: 1.0,
            reason: `Tag-filtered review (tags: ${this.filter.include.join(', ')})`,
          },
        ],
      })),
      ...newCards.map((c) => ({
        cardId: c.cardID,
        courseId: c.courseID,
        score: 1.0,
        provenance: [
          {
            strategy: 'tagFilter',
            strategyName: 'Tag Filter',
            strategyId: 'TAG_FILTER',
            action: 'generated' as const,
            score: 1.0,
            reason: `Tag-filtered new card (tags: ${this.filter.include.join(', ')})`,
          },
        ],
      })),
    ];

    // Reviews first, then new cards; respect limit
    return weighted.slice(0, limit);
  }

  /**
   * Clears the cached resolved card IDs.
   * Call this if the underlying tag data may have changed during a session.
   */
  public clearCache(): void {
    this.resolvedCardIds = null;
  }

  /**
   * Returns the course ID this source is filtering.
   */
  public getCourseId(): string {
    return this.courseId;
  }

  /**
   * Returns the active tag filter.
   */
  public getFilter(): TagFilter {
    return this.filter;
  }
}
