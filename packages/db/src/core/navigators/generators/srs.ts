import moment from 'moment';
import type { ScheduledCard } from '../../types/user';
import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import { ContentNavigator } from '../index';
import { captureSrsBacklog } from '../SrsDebugger';
import type { ContentNavigationStrategyData } from '../../types/contentNavigationStrategy';
import type { CardGenerator, GeneratorContext, GeneratorResult } from './types';
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
 * Growth-rate base for backlog pressure as a *multiplier* on review urgency.
 *
 * Backlog pressure is multiplicative (×1.0 at/below healthy) and exponential
 * in the backlog's excess over healthy, expressed in multiples of
 * `healthyBacklog` (see computeBacklogMultiplier) — deliberately uncapped. It
 * replaces an older additive +0..+0.5 term that was a [0,1]-era modifier —
 * once review scores stopped being clamped to 1.0 and new cards could be
 * boosted well past it (e.g. an intro ×5 → 7+), a flat +0.5 was both too small
 * to compete and mostly eaten by the old 1.0 clamp. A linear-then-capped
 * multiplier came next, but that just moved the problem: other generators
 * (e.g. Prescribed Intro Backpressure) score on a much larger open scale with
 * their own, independently-tuned caps, so a hard review-side ceiling meant
 * reviews could never win out no matter how backlogged they got. Exponential
 * growth has no such ceiling — a sufficiently neglected backlog keeps
 * climbing until it outcompetes anything, which is the intended long-term
 * fallback: other generators can dominate short-term, but SRS is the
 * framework-invariant backstop and should always win eventually. Tunable —
 * verify review vs new ordering in the dbg overlay's "review backpressure"
 * panel.
 */
const BACKLOG_GROWTH_RATE = 2;

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
  async getWeightedCards(limit: number, _context?: GeneratorContext): Promise<GeneratorResult> {
    if (!this.user || !this.course) {
      throw new Error('SRSNavigator requires user and course to be set');
    }

    // [perf] re-enabled 2026-07 (todo-replan-db-perf): review-path cost (getPendingReviews)
    const tSrs0 = performance.now();
    const courseId = this.course.getCourseID();
    const reviews = await this.user.getPendingReviews(courseId);
    const tReviews = performance.now();
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

    // Compute backlog pressure (multiplicative) - applies globally to all reviews
    const backlogMultiplier = this.computeBacklogMultiplier(dueReviews.length);

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
      const pressureNote =
        backlogMultiplier > 1
          ? ` [backlog pressure: ×${backlogMultiplier.toFixed(2)}]`
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
      const { score, reason } = this.computeUrgencyScore(review, now, backlogMultiplier);

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
    const sorted = scored.sort((a, b) => b.score - a.score);

    // Capture backlog state for the live session overlay (see SrsDebugger).
    captureSrsBacklog({
      courseId,
      scheduledTotal: reviews.length,
      dueNow: dueReviews.length,
      healthyBacklog: this.healthyBacklog,
      backlogMultiplier,
      backlogGrowthRate: BACKLOG_GROWTH_RATE,
      topReviewScore: sorted.length > 0 ? sorted[0].score : null,
      nextDueIn,
      timestamp: Date.now(),
    });

    // [perf] re-enabled 2026-07 (todo-replan-db-perf): SRSgen / getPendingReviews timing
    logger.info(
      `[perf][SRSgen] total=${(performance.now() - tSrs0).toFixed(0)}ms ` +
        `(pendingReviews=${(tReviews - tSrs0).toFixed(0)}) ` +
        `[scheduled=${reviews.length} due=${dueReviews.length}]`
    );
    return { cards: sorted.slice(0, limit) };
  }

  /**
   * Compute the multiplicative backlog pressure based on number of due reviews.
   *
   * ×1.0 at or below the healthy threshold (no boost); above it, grows as
   * BACKLOG_GROWTH_RATE raised to the excess expressed in multiples of the
   * healthy threshold. Uncapped — self-regulating instead: reviews winning
   * slots depletes dueCount, which drops the ratio and relaxes the multiplier
   * next run.
   *
   * Examples (with default healthyBacklog=20, BACKLOG_GROWTH_RATE=1.5):
   * - 10 due reviews → ×1.00  (healthy)
   * - 20 due reviews → ×1.00  (at threshold, ratio 0)
   * - 40 due reviews → ×1.50  (ratio 1, 2x threshold)
   * - 60 due reviews → ×2.25  (ratio 2, 3x threshold — old hard cap was ×2.00 here)
   * - 100 due reviews → ×5.06 (ratio 4, 5x threshold)
   * - 160 due reviews → ×17.09 (ratio 7, 8x threshold)
   *
   * @param dueCount - Number of reviews currently due
   * @returns Multiplier applied to review urgency (>= 1.0, unbounded)
   */
  private computeBacklogMultiplier(dueCount: number): number {
    if (dueCount <= this.healthyBacklog) {
      return 1.0;
    }

    const excess = dueCount - this.healthyBacklog;
    const ratio = excess / this.healthyBacklog;

    return Math.pow(BACKLOG_GROWTH_RATE, ratio);
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
   * 3. Backlog pressure = global *multiplier* when review backlog exceeds the
   *    healthy threshold (×1.0 healthy → exponential growth, uncapped, above it).
   *
   * Combined: (base 0.5 + urgency factors * 0.45) × backlog multiplier.
   * Per-card range before pressure: ~0.57–0.95. NOT clamped to 1.0 — under a
   * heavy backlog reviews scale onto the open scale to compete with (and exceed)
   * new cards; there's no ceiling at all now, so a bad enough backlog always
   * wins eventually — self-regulating because winning slots depletes dueCount.
   *
   * @param review - The scheduled card to score
   * @param now - Current time
   * @param backlogMultiplier - Pre-computed backlog multiplier (>= 1.0, unbounded)
   */
  private computeUrgencyScore(
    review: ScheduledCard,
    now: moment.Moment,
    backlogMultiplier: number
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

    // Final score: per-card urgency (base 0.5 + contribution) scaled by the
    // global backlog multiplier. No 1.0 clamp — reviews compete on the open
    // scale; the bounded multiplier (not a ceiling) caps the lift.
    const baseScore = 0.5 + urgency * 0.45;
    const score = baseScore * backlogMultiplier;

    // Build reason string with all contributing factors
    const reasonParts = [
      `${Math.round(hoursOverdue)}h overdue`,
      `interval: ${Math.round(intervalHours)}h`,
      `relative: ${relativeOverdue.toFixed(2)}`,
      `recency: ${recencyFactor.toFixed(2)}`,
    ];

    if (backlogMultiplier > 1) {
      reasonParts.push(`backlog: ×${backlogMultiplier.toFixed(2)}`);
    }

    reasonParts.push('review');

    const reason = reasonParts.join(', ');

    return { score, reason };
  }
}
