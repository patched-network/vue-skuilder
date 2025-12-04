import type {
  CourseDBInterface,
  QualifiedCardID,
  StudySessionNewItem,
  StudySessionReviewItem,
  UserDBInterface,
} from '..';
import type { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import type { ScheduledCard } from '../types/user';
import { ContentNavigator } from './index';
import type { WeightedCard } from './index';
import type { CardGenerator, GeneratorContext } from './generators/types';
import { logger } from '../../util/logger';

// ============================================================================
// HARDCODED ORDER NAVIGATOR
// ============================================================================
//
// A generator strategy that presents cards in a fixed, author-defined order.
//
// Use case: When course authors want explicit control over content sequencing,
// e.g., teaching letters in a specific pedagogical order.
//
// The order is defined in serializedData as a JSON array of card IDs.
// Earlier positions in the array get higher scores.
//
// ============================================================================

/**
 * A navigation strategy that presents cards in a fixed order.
 *
 * Implements CardGenerator for use in Pipeline architecture.
 * Also extends ContentNavigator for backward compatibility with legacy code.
 *
 * Scoring:
 * - Earlier cards in the sequence get higher scores
 * - Reviews get score 1.0 (highest priority)
 * - New cards scored by position: 1.0 - (position / total) * 0.5
 */
export default class HardcodedOrderNavigator extends ContentNavigator implements CardGenerator {
  /** Human-readable name for CardGenerator interface */
  name: string;

  private orderedCardIds: string[] = [];

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super(user, course, strategyData);
    this.name = strategyData.name || 'Hardcoded Order';

    if (strategyData.serializedData) {
      try {
        this.orderedCardIds = JSON.parse(strategyData.serializedData);
      } catch (e) {
        logger.error('Failed to parse serializedData for HardcodedOrderNavigator', e);
      }
    }
  }

  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const reviews = await this.user.getPendingReviews(this.course.getCourseID());
    return reviews.map((r) => {
      return {
        ...r,
        contentSourceType: 'course',
        contentSourceID: this.course.getCourseID(),
        cardID: r.cardId,
        courseID: r.courseId,
        reviewID: r._id,
        status: 'review',
      };
    });
  }

  async getNewCards(limit: number = 99): Promise<StudySessionNewItem[]> {
    const activeCardIds = (await this.user.getActiveCards()).map((c: QualifiedCardID) => c.cardID);

    const newCardIds = this.orderedCardIds.filter((cardId) => !activeCardIds.includes(cardId));

    const cardsToReturn = newCardIds.slice(0, limit);

    return cardsToReturn.map((cardId) => {
      return {
        cardID: cardId,
        courseID: this.course.getCourseID(),
        contentSourceType: 'course',
        contentSourceID: this.course.getCourseID(),
        status: 'new',
      };
    });
  }

  /**
   * Get cards in hardcoded order with scores based on position.
   *
   * Earlier cards in the sequence get higher scores.
   * Score formula: 1.0 - (position / totalCards) * 0.5
   * This ensures scores range from 1.0 (first card) to 0.5+ (last card).
   *
   * This method supports both the legacy signature (limit only) and the
   * CardGenerator interface signature (limit, context).
   *
   * @param limit - Maximum number of cards to return
   * @param _context - Optional GeneratorContext (currently unused, but required for interface)
   */
  async getWeightedCards(limit: number, _context?: GeneratorContext): Promise<WeightedCard[]> {
    const activeCardIds = (await this.user.getActiveCards()).map((c: QualifiedCardID) => c.cardID);
    const reviews = await this.getPendingReviews();

    // Filter out already-active cards
    const newCardIds = this.orderedCardIds.filter((cardId) => !activeCardIds.includes(cardId));

    const totalCards = newCardIds.length;

    // Score new cards by position in sequence
    const scoredNew: WeightedCard[] = newCardIds.slice(0, limit).map((cardId, index) => {
      const position = index + 1;
      const score = Math.max(0.5, 1.0 - (index / totalCards) * 0.5);

      return {
        cardId,
        courseId: this.course.getCourseID(),
        score,
        provenance: [
          {
            strategy: 'hardcodedOrder',
            strategyName: this.strategyName || this.name,
            strategyId: this.strategyId || 'NAVIGATION_STRATEGY-hardcoded',
            action: 'generated',
            score,
            reason: `Position ${position} of ${totalCards} in fixed sequence, new card`,
          },
        ],
      };
    });

    // Score reviews at 1.0 (highest priority)
    const scoredReviews: WeightedCard[] = reviews.map((r) => ({
      cardId: r.cardID,
      courseId: r.courseID,
      score: 1.0,
      provenance: [
        {
          strategy: 'hardcodedOrder',
          strategyName: this.strategyName || this.name,
          strategyId: this.strategyId || 'NAVIGATION_STRATEGY-hardcoded',
          action: 'generated',
          score: 1.0,
          reason: 'Scheduled review, highest priority',
        },
      ],
    }));

    // Combine (reviews already sorted at top due to score=1.0)
    const all = [...scoredReviews, ...scoredNew];
    all.sort((a, b) => b.score - a.score);

    return all.slice(0, limit);
  }
}
