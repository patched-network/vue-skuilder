import { StudyContentSource } from '@db/core/interfaces/contentSource';
import { WeightedCard } from '@db/core/navigators';
import { UserDBInterface } from '@db/core';
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
   * Get cards with suitability scores for presentation.
   *
   * Filters cards by tag inclusion/exclusion and assigns score=1.0 to all.
   * TagFilteredContentSource does not currently support pluggable navigation
   * strategies - it returns flat-scored candidates.
   *
   * @param limit - Maximum number of cards to return
   * @returns Cards sorted by score descending (all scores = 1.0)
   */
  public async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    if (!hasActiveFilter(this.filter)) {
      logger.warn('[TagFilteredContentSource] getWeightedCards called with no active filter');
      return [];
    }

    const eligibleCardIds = await this.resolveFilteredCardIds();

    // Get new cards: eligible cards that are not already active
    const activeCards = await this.user.getActiveCards();
    const activeCardIds = new Set(activeCards.map((c) => c.cardID));

    const newCardWeighted: WeightedCard[] = [];
    for (const cardId of eligibleCardIds) {
      if (!activeCardIds.has(cardId)) {
        newCardWeighted.push({
          cardId,
          courseId: this.courseId,
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
        });
      }

      if (newCardWeighted.length >= limit) {
        break;
      }
    }

    logger.info(
      `[TagFilteredContentSource] Found ${newCardWeighted.length} new cards matching filter`
    );

    // Get pending reviews: reviews for cards in the eligible set
    const allReviews = await this.user.getPendingReviews(this.courseId);
    const filteredReviews = allReviews.filter((review) => eligibleCardIds.has(review.cardId));

    logger.info(
      `[TagFilteredContentSource] Found ${filteredReviews.length} pending reviews matching filter ` +
        `(of ${allReviews.length} total)`
    );

    const reviewWeighted: WeightedCard[] = filteredReviews.map((r) => ({
      cardId: r.cardId,
      courseId: r.courseId,
      score: 1.0,
      reviewID: r._id,
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
    }));

    // Reviews first, then new cards; respect limit
    return [...reviewWeighted, ...newCardWeighted].slice(0, limit);
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
