import moment from 'moment';
import type { ScheduledCard } from '../../types/user';
import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import { ContentNavigator } from '../index';
import { captureSrsBacklog } from '../SrsDebugger';
import { DEFAULT_REGULATOR_CONFIG } from '../regulators';
import type { ContentNavigationStrategyData } from '../../types/contentNavigationStrategy';
import type { CardGenerator, GeneratorContext, GeneratorResult } from './types';
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
// Backlog pressure (reviews piling up) isn't scored here: the pipeline's
// regulator stage measures the due backlog's *mass* after filters (so reviews
// the learner has moved beyond weigh little) and scales all reviews by it.
// See regulators.ts.
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
 * Configuration for the SRS strategy.
 */
export interface SRSConfig {
  /**
   * @deprecated Ignored. Backlog pressure moved to the pipeline's regulator
   * stage, which measures review mass (see regulators.ts).
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
  async getWeightedCards(limit: number, _context?: GeneratorContext): Promise<GeneratorResult> {
    if (!this.user || !this.course) {
      throw new Error('SRSNavigator requires user and course to be set');
    }

    // [perf] parked 2026-05 (pipeline-docs-workup) — uncomment to re-measure
    // const tSrs0 = performance.now();
    const courseId = this.course.getCourseID();
    const reviews = await this.user.getPendingReviews(courseId);
    // const tReviews = performance.now();
    const now = moment.utc();

    // Filter to only cards that are actually due
    let dueReviews = reviews.filter((r) => now.isAfter(moment.utc(r.reviewTime)));

    // Remove scheduled reviews for cards tagged srs:skip (e.g. intro cards).
    // These were scheduled before the tag convention existed — clean them up.
    if (dueReviews.length > 0) {
      const dueCardIds = [...new Set(dueReviews.map((r) => r.cardId))];
      const tagsByCard = await this.course!.getAppliedTagsBatch(dueCardIds);
      const skippedReviewIds: string[] = [];
      dueReviews = dueReviews.filter((r) => {
        const tags = tagsByCard.get(r.cardId) ?? [];
        if (tags.includes('srs:skip')) {
          skippedReviewIds.push(r._id);
          return false;
        }
        return true;
      });
      if (skippedReviewIds.length > 0) {
        logger.info(`[SRS] Removing ${skippedReviewIds.length} scheduled reviews for srs:skip cards`);
        for (const id of skippedReviewIds) {
          void this.user!.removeScheduledCardReview(id);
        }
      }
    }

    // Time until the next not-yet-due review (for the debug overlay): shows
    // reviews are *coming* even when none are due right now.
    const notDue = reviews.filter((r) => !now.isAfter(moment.utc(r.reviewTime)));
    let nextDueIn: string | null = null;
    if (notDue.length > 0) {
      const next = notDue.reduce((a, b) =>
        moment.utc(a.reviewTime).isBefore(moment.utc(b.reviewTime)) ? a : b
      );
      const until = moment.duration(moment.utc(next.reviewTime).diff(now));
      nextDueIn =
        until.asHours() < 1
          ? `${Math.round(until.asMinutes())}m`
          : until.asHours() < 24
            ? `${Math.round(until.asHours())}h`
            : `${Math.round(until.asDays())}d`;
    }

    // Log review status for transparency
    if (dueReviews.length > 0) {
      logger.info(
        `[SRS] Course ${courseId}: ${dueReviews.length} reviews due now (of ${reviews.length} scheduled)`
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
      const { score, urgency, reason } = this.computeUrgencyScore(review, now);

      return {
        cardId: review.cardId,
        courseId: review.courseId,
        score,
        reviewUrgency: urgency,
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
    const sorted = scored.sort((a, b) => b.score - a.score);

    // Capture backlog state for the live session overlay (see SrsDebugger). The
    // regulator stage patches in review mass and its multiplier after filters.
    captureSrsBacklog({
      courseId,
      scheduledTotal: reviews.length,
      dueNow: dueReviews.length,
      healthyBacklog: DEFAULT_REGULATOR_CONFIG.reviewMass.healthyMass,
      reviewMass: null,
      backlogMultiplier: 1,
      backlogGrowthRate: DEFAULT_REGULATOR_CONFIG.reviewMass.rate,
      topReviewScore: sorted.length > 0 ? sorted[0].score : null,
      nextDueIn,
      timestamp: Date.now(),
    });

    // [perf] parked: SRSgen / getPendingReviews timing
    // const srsResult = { cards: sorted.slice(0, limit) };
    // logger.info(
    //   `[perf][SRSgen] total=${(performance.now() - tSrs0).toFixed(0)}ms ` +
    //     `(pendingReviews=${(tReviews - tSrs0).toFixed(0)}) ` +
    //     `[scheduled=${reviews.length} due=${dueReviews.length}]`
    // );
    return { cards: sorted.slice(0, limit) };
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
   * Combined: base 0.5 + urgency factors * 0.45, so ~0.57–0.95 per card.
   * Backlog pressure is applied later, by the regulator stage, which can lift
   * reviews onto the open scale above new cards (see regulators.ts).
   *
   * @param review - The scheduled card to score
   * @param now - Current time
   */
  private computeUrgencyScore(
    review: ScheduledCard,
    now: moment.Moment
  ): { score: number; urgency: number; reason: string } {
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

    // Final score: per-card urgency, base 0.5 + contribution.
    const score = 0.5 + urgency * 0.45;

    // Build reason string with all contributing factors
    const reasonParts = [
      `${Math.round(hoursOverdue)}h overdue`,
      `interval: ${Math.round(intervalHours)}h`,
      `relative: ${relativeOverdue.toFixed(2)}`,
      `recency: ${recencyFactor.toFixed(2)}`,
    ];

    reasonParts.push('review');

    const reason = reasonParts.join(', ');

    return { score, urgency, reason };
  }
}
