import moment from 'moment';
import type { ScheduledCard } from '../../types/user';
import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import type { ContentNavigationStrategyData } from '../../types/contentNavigationStrategy';
import type { CardGenerator, GeneratorContext } from './types';
import { logger } from '@db/util/logger';

// ============================================================================
// SRS NAVIGATOR
// ============================================================================
//
// A generator strategy that scores review cards by urgency.
//
// Urgency is determined by three factors:
// 1. Overdueness - how far past the scheduled review time
// 2. Interval recency - shorter scheduled intervals indicate "novel content in progress"
// 3. Backlog pressure - when too many reviews pile up, urgency increases globally
//
// A card with a 3-day interval that's 2 days overdue is more urgent than a card
// with a 6-month interval that's 2 days overdue. The shorter interval represents
// active learning at higher resolution.
//
// DESIGN PHILOSOPHY: SRS scheduling times are "eligibility dates" not hard "due dates".
// When a card becomes eligible, it is "okish" to review now, but reviewing a little
// later may be optimal. We don't aim to always beat review queues to zero (death spiral),
// but rather maintain a healthy backlog of eligible reviews so the system can gracefully
// handle usage upticks or breaks.
//
// This navigator only handles reviews - it does not generate new cards.
// For new cards, use ELONavigator or another generator via CompositeGenerator.
//
// ============================================================================

/**
 * Default healthy backlog size.
 * When due reviews exceed this, backlog pressure kicks in.
 * Can be overridden via strategy config.
 */
const DEFAULT_HEALTHY_BACKLOG = 20;

/**
 * Maximum backlog pressure contribution to score.
 * At 3x healthy backlog, pressure maxes out.
 */
const MAX_BACKLOG_PRESSURE = 0.5;

/**
 * Configuration for the SRS strategy.
 */
export interface SRSConfig {
  /**
   * Target "healthy" backlog size.
   * When due reviews exceed this, urgency increases globally.
   * Default: 20
   */
  healthyBacklog?: number;
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
 * - When backlog exceeds "healthy" threshold, all reviews get urgency boost
 *
 * Only returns cards that are actually due (reviewTime has passed).
 * Does not generate new cards - use with CompositeGenerator for mixed content.
 */
export default class SRSNavigator extends ContentNavigator implements CardGenerator {
  /** Human-readable name for CardGenerator interface */
  name: string;

  /** Healthy backlog threshold - when exceeded, backlog pressure kicks in */
  private healthyBacklog: number;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData?: ContentNavigationStrategyData
  ) {
    super(user, course, strategyData as ContentNavigationStrategyData);
    this.name = strategyData?.name || 'SRS';

    // Parse config from serializedData if available
    const config = this.parseConfig(strategyData?.serializedData);
    this.healthyBacklog = config.healthyBacklog ?? DEFAULT_HEALTHY_BACKLOG;
  }

  /**
   * Parse configuration from serialized JSON.
   */
  private parseConfig(serializedData?: string): SRSConfig {
    if (!serializedData) return {};
    try {
      return JSON.parse(serializedData) as SRSConfig;
    } catch {
      logger.warn('[SRS] Failed to parse strategy config, using defaults');
      return {};
    }
  }

  /**
   * Get review cards scored by urgency.
   *
   * Score formula combines:
   * - Relative overdueness: hoursOverdue / intervalHours
   * - Interval recency: exponential decay favoring shorter intervals
   * - Backlog pressure: boost when due reviews exceed healthy threshold
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

    const courseId = this.course.getCourseID();
    const reviews = await this.user.getPendingReviews(courseId);
    const now = moment.utc();

    // Filter to only cards that are actually due
    const dueReviews = reviews.filter((r) => now.isAfter(moment.utc(r.reviewTime)));

    // Compute backlog pressure - applies globally to all reviews
    const backlogPressure = this.computeBacklogPressure(dueReviews.length);

    // Log review status for transparency
    if (dueReviews.length > 0) {
      const pressureNote =
        backlogPressure > 0
          ? ` [backlog pressure: +${backlogPressure.toFixed(2)}]`
          : ` [healthy backlog]`;
      logger.info(
        `[SRS] Course ${courseId}: ${dueReviews.length} reviews due now (of ${reviews.length} scheduled)${pressureNote}`
      );
    } else if (reviews.length > 0) {
      // Reviews exist but none are due yet - show when next one is due
      const sortedByDue = [...reviews].sort((a, b) =>
        moment.utc(a.reviewTime).diff(moment.utc(b.reviewTime))
      );
      const nextDue = sortedByDue[0];
      const nextDueTime = moment.utc(nextDue.reviewTime);
      const untilDue = moment.duration(nextDueTime.diff(now));
      const untilDueStr =
        untilDue.asHours() < 1
          ? `${Math.round(untilDue.asMinutes())}m`
          : untilDue.asHours() < 24
            ? `${Math.round(untilDue.asHours())}h`
            : `${Math.round(untilDue.asDays())}d`;
      logger.info(
        `[SRS] Course ${courseId}: 0 reviews due now (${reviews.length} scheduled, next in ${untilDueStr})`
      );
    } else {
      logger.info(`[SRS] Course ${courseId}: No reviews scheduled`);
    }

    const scored = dueReviews.map((review) => {
      const { score, reason } = this.computeUrgencyScore(review, now, backlogPressure);

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

    // Sort by score descending and limit
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Compute backlog pressure based on number of due reviews.
   *
   * Backlog pressure is 0 when at or below healthy threshold,
   * and increases linearly above it, maxing out at MAX_BACKLOG_PRESSURE.
   *
   * Examples (with default healthyBacklog=20):
   * - 10 due reviews → 0.00 (healthy)
   * - 20 due reviews → 0.00 (at threshold)
   * - 40 due reviews → 0.25 (2x threshold)
   * - 60 due reviews → 0.50 (3x threshold, maxed)
   *
   * @param dueCount - Number of reviews currently due
   * @returns Backlog pressure score to add to urgency (0 to MAX_BACKLOG_PRESSURE)
   */
  private computeBacklogPressure(dueCount: number): number {
    if (dueCount <= this.healthyBacklog) {
      return 0;
    }

    // Linear increase: at 2x healthy, pressure = 0.25; at 3x, pressure = 0.50
    const excess = dueCount - this.healthyBacklog;
    const pressure = (excess / this.healthyBacklog) * (MAX_BACKLOG_PRESSURE / 2);

    return Math.min(MAX_BACKLOG_PRESSURE, pressure);
  }

  /**
   * Compute urgency score for a review card.
   *
   * Three factors:
   * 1. Relative overdueness = hoursOverdue / intervalHours
   *    - 2 days overdue on 3-day interval = 0.67 (urgent)
   *    - 2 days overdue on 180-day interval = 0.01 (not urgent)
   *
   * 2. Interval recency factor = 0.3 + 0.7 * exp(-intervalHours / 720)
   *    - 24h interval → ~1.0 (very recent learning)
   *    - 30 days (720h) → ~0.56
   *    - 180 days → ~0.30
   *
   * 3. Backlog pressure = global boost when review backlog exceeds healthy threshold
   *    - At healthy backlog: 0
   *    - At 2x healthy: +0.25
   *    - At 3x+ healthy: +0.50 (max)
   *
   * Combined: base 0.5 + (urgency factors * 0.45) + backlog pressure
   * Result range: 0.5 to 1.0 (uncapped to allow high-urgency reviews to compete with new cards)
   *
   * @param review - The scheduled card to score
   * @param now - Current time
   * @param backlogPressure - Pre-computed backlog pressure (0 to 0.5)
   */
  private computeUrgencyScore(
    review: ScheduledCard,
    now: moment.Moment,
    backlogPressure: number
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

    // Final score: base 0.5 + urgency contribution + backlog pressure
    // Uncapped at 1.0 (no 0.95 ceiling) - allows high-urgency reviews to compete with new cards
    const baseScore = 0.5 + urgency * 0.45;
    const score = Math.min(1.0, baseScore + backlogPressure);

    // Build reason string with all contributing factors
    const reasonParts = [
      `${Math.round(hoursOverdue)}h overdue`,
      `interval: ${Math.round(intervalHours)}h`,
      `relative: ${relativeOverdue.toFixed(2)}`,
      `recency: ${recencyFactor.toFixed(2)}`,
    ];

    if (backlogPressure > 0) {
      reasonParts.push(`backlog: +${backlogPressure.toFixed(2)}`);
    }

    reasonParts.push('review');

    const reason = reasonParts.join(', ');

    return { score, reason };
  }
}