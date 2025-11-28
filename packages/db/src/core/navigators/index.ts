import {
  StudyContentSource,
  UserDBInterface,
  CourseDBInterface,
  StudySessionReviewItem,
  StudySessionNewItem,
} from '..';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { ScheduledCard } from '../types/user';
import { logger } from '../../util/logger';

/**
 * A card with a suitability score for presentation.
 *
 * Scores range from 0-1:
 * - 1.0 = fully suitable
 * - 0.0 = hard filter (e.g., prerequisite not met)
 * - 0.5 = neutral
 * - Intermediate values = soft preference
 */
export interface WeightedCard {
  cardId: string;
  courseId: string;
  /** Suitability score from 0-1 */
  score: number;
  /** Origin of the card */
  source: 'new' | 'review' | 'failed';
}

export enum Navigators {
  ELO = 'elo',
  HARDCODED = 'hardcodedOrder',
  HIERARCHY = 'hierarchyDefinition',
  INTERFERENCE = 'interferenceMitigator',
  RELATIVE_PRIORITY = 'relativePriority',
}

/**
 * A content-navigator provides runtime steering of study sessions.
 */
export abstract class ContentNavigator implements StudyContentSource {
  /**
   *
   * @param user
   * @param strategyData
   * @returns the runtime object used to steer a study session.
   */
  static async create(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ): Promise<ContentNavigator> {
    const implementingClass = strategyData.implementingClass;
    let NavigatorImpl;

    // Try different extension variations
    const variations = ['.ts', '.js', ''];

    for (const ext of variations) {
      try {
        const module = await import(`./${implementingClass}${ext}`);
        NavigatorImpl = module.default;
        break; // Break the loop if loading succeeds
      } catch (e) {
        // Continue to next variation if this one fails
        logger.debug(`Failed to load with extension ${ext}:`, e);
      }
    }

    if (!NavigatorImpl) {
      throw new Error(`Could not load navigator implementation for: ${implementingClass}`);
    }

    return new NavigatorImpl(user, course, strategyData);
  }

  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;

  /**
   * Get cards with suitability scores.
   *
   * This is the primary method for the new weighted-card architecture.
   * Filter strategies can wrap a delegate and transform its output.
   *
   * @param limit - Maximum cards to return
   * @returns Cards sorted by score descending
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Default implementation: delegate to legacy methods, assign score=1.0
    const newCards = await this.getNewCards(limit);
    const reviews = await this.getPendingReviews();

    const weighted: WeightedCard[] = [
      ...newCards.map((c) => ({
        cardId: c.cardID,
        courseId: c.courseID,
        score: 1.0,
        source: 'new' as const,
      })),
      ...reviews.map((r) => ({
        cardId: r.cardID,
        courseId: r.courseID,
        score: 1.0,
        source: 'review' as const,
      })),
    ];

    return weighted.slice(0, limit);
  }
}
