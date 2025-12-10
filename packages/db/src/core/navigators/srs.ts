import moment from 'moment';
import type { ScheduledCard } from '../types/user';
import type { CourseDBInterface } from '../interfaces/courseDB';
import type { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator } from './index';
import type { WeightedCard } from './index';
import type { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import type { CardGenerator, GeneratorContext } from './generators/types';
import { logger } from '@db/util/logger';

// ============================================================================
// SRS NAVIGATOR
// ============================================================================
//
// A generator strategy that scores review cards by urgency.
//
// Urgency is determined by two factors:
// 1. Overdueness - how far past the scheduled review time
// 2. Interval recency - shorter scheduled intervals indicate "novel content in progress"
//
// A card with a 3-day interval that's 2 days overdue is more urgent than a card
// with a 6-month interval that's 2 days overdue. The shorter interval represents
// active learning at higher resolution.
//
// This navigator only handles reviews - it does not generate new cards.
// For new cards, use ELONavigator or another generator via CompositeGenerator.
//
// ============================================================================

/**
 * Configuration for the SRS strategy.
 * Currently minimal - the algorithm is not parameterized.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SRSConfig {
  // Future: configurable urgency curves, thresholds, etc.
}

/**
 * A navigation strategy that scores review cards by urgency.
 *
 * Implements CardGenerator for use in Pipeline architecture.
 * Also extends ContentNavigator for backward compatibility with legacy code.
 *
 * Higher scores indicate more urgent reviews:
 * - Cards that are more overdue (relative to their interval) score higher
 * - Cards with shorter intervals (recent learning) score higher
 *
 * Only returns cards that are actually due (reviewTime has passed).
 * Does not generate new cards - use with CompositeGenerator for mixed content.
 */
export default class SRSNavigator extends ContentNavigator implements CardGenerator {
  /** Human-readable name for CardGenerator interface */
  name: string;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData?: ContentNavigationStrategyData
  ) {
    super(user, course, strategyData as ContentNavigationStrategyData);
    this.name = strategyData?.name || 'SRS';
  }

  /**
   * Get review cards scored by urgency.
   *
   * Score formula combines:
   * - Relative overdueness: hoursOverdue / intervalHours
   * - Interval recency: exponential decay favoring shorter intervals
   *
   * Cards not yet due are excluded (not scored as 0).
   *
   * This method supports both the legacy signature (limit only) and the
   * CardGenerator interface signature (limit, context).
   *
   * @param limit - Maximum number of cards to return
   * @param _context - Optional GeneratorContext (currently unused, but required for interface)
   */
  async getWeightedCards(limit: number, _context?: GeneratorContext): Promise<WeightedCard[]> {
    if (!this.user || !this.course) {
      throw new Error('SRSNavigator requires user and course to be set');
    }

    const reviews = await this.user.getPendingReviews(this.course.getCourseID());
    const now = moment.utc();

    // Filter to only cards that are actually due
    const dueReviews = reviews.filter((r) => now.isAfter(moment.utc(r.reviewTime)));

    const scored = dueReviews.map((review) => {
      const { score, reason } = this.computeUrgencyScore(review, now);

      return {
        cardId: review.cardId,
        courseId: review.courseId,
        score,
        reviewID: review._id,
        provenance: [
          {
            strategy: 'srs',
            strategyName: this.strategyName || this.name,
            strategyId: this.strategyId || 'NAVIGATION_STRATEGY-SRS-default',
            action: 'generated' as const,
            score,
            reason,
          },
        ],
      };
    });

    logger.debug(`[srsNav] got ${scored.length} weighted cards`);

    // Sort by score descending and limit
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Compute urgency score for a review card.
   *
   * Two factors:
   * 1. Relative overdueness = hoursOverdue / intervalHours
   *    - 2 days overdue on 3-day interval = 0.67 (urgent)
   *    - 2 days overdue on 180-day interval = 0.01 (not urgent)
   *
   * 2. Interval recency factor = 0.3 + 0.7 * exp(-intervalHours / 720)
   *    - 24h interval → ~1.0 (very recent learning)
   *    - 30 days (720h) → ~0.56
   *    - 180 days → ~0.30
   *
   * Combined: base 0.5 + weighted average of factors * 0.45
   * Result range: approximately 0.5 to 0.95
   */
  private computeUrgencyScore(
    review: ScheduledCard,
    now: moment.Moment
  ): { score: number; reason: string } {
    const scheduledAt = moment.utc(review.scheduledAt);
    const due = moment.utc(review.reviewTime);

    // Interval = time between scheduling and due date (minimum 1 hour to avoid division issues)
    const intervalHours = Math.max(1, due.diff(scheduledAt, 'hours'));
    const hoursOverdue = now.diff(due, 'hours');

    // Relative overdueness: how late relative to the interval
    const relativeOverdue = hoursOverdue / intervalHours;

    // Interval recency factor: shorter intervals = more urgent
    // Exponential decay with 720h (30 days) as the characteristic time
    const recencyFactor = 0.3 + 0.7 * Math.exp(-intervalHours / 720);

    // Combined urgency: weighted average of relative overdue and recency
    // Clamp relative overdue contribution to [0, 1] to avoid runaway scores
    const overdueContribution = Math.min(1.0, Math.max(0, relativeOverdue));
    const urgency = overdueContribution * 0.5 + recencyFactor * 0.5;

    // Final score: base 0.5 + urgency contribution, capped at 0.95
    const score = Math.min(0.95, 0.5 + urgency * 0.45);

    const reason =
      `${Math.round(hoursOverdue)}h overdue (interval: ${Math.round(intervalHours)}h, ` +
      `relative: ${relativeOverdue.toFixed(2)}), recency: ${recencyFactor.toFixed(2)}, review`;

    return { score, reason };
  }

}
