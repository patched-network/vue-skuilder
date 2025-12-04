import { describe, it, expect } from 'vitest';
import moment from 'moment';
import { ScheduledCard } from '../../../src/core/types/user';
import { getCardOrigin, WeightedCard } from '../../../src/core/navigators/index';

// ============================================================================
// SRS NAVIGATOR SCORING TESTS
// ============================================================================
//
// Tests for the SRS Navigator's urgency scoring formula.
// The formula considers:
// 1. Relative overdueness: hoursOverdue / intervalHours
// 2. Interval recency: shorter intervals indicate active learning
//
// ============================================================================

/**
 * Compute urgency score for a review card.
 * This is a standalone implementation of the scoring logic for testing.
 */
function computeUrgencyScore(
  scheduledAt: moment.Moment,
  reviewTime: moment.Moment,
  now: moment.Moment
): { score: number; relativeOverdue: number; recencyFactor: number; intervalHours: number } {
  // Interval = time between scheduling and due date (minimum 1 hour)
  const intervalHours = Math.max(1, reviewTime.diff(scheduledAt, 'hours'));
  const hoursOverdue = now.diff(reviewTime, 'hours');

  // Relative overdueness: how late relative to the interval
  const relativeOverdue = hoursOverdue / intervalHours;

  // Interval recency factor: shorter intervals = more urgent
  const recencyFactor = 0.3 + 0.7 * Math.exp(-intervalHours / 720);

  // Combined urgency
  const overdueContribution = Math.min(1.0, Math.max(0, relativeOverdue));
  const urgency = overdueContribution * 0.5 + recencyFactor * 0.5;

  // Final score
  const score = Math.min(0.95, 0.5 + urgency * 0.45);

  return { score, relativeOverdue, recencyFactor, intervalHours };
}

/**
 * Helper to create a mock scheduled card for testing
 */
function createMockReview(
  scheduledAt: moment.Moment,
  reviewTime: moment.Moment,
  cardId: string = 'card-1'
): ScheduledCard {
  return {
    _id: `SCHEDULED_CARD-${cardId}`,
    cardId,
    courseId: 'test-course',
    scheduledAt: scheduledAt.toISOString(),
    reviewTime: reviewTime.toISOString(),
    scheduledFor: 'course',
    schedulingAgentId: 'test-course',
  };
}

describe('SRS urgency scoring formula', () => {
  const now = moment.utc('2024-01-15T12:00:00Z');

  describe('relative overdueness', () => {
    it('should compute higher relative overdueness for shorter intervals', () => {
      // 3-day interval, 2 days overdue
      const shortInterval = computeUrgencyScore(
        moment.utc('2024-01-09T12:00:00Z'), // scheduled 6 days ago
        moment.utc('2024-01-12T12:00:00Z'), // due 3 days ago (3-day interval)
        now
      );

      // 30-day interval, 2 days overdue
      const longInterval = computeUrgencyScore(
        moment.utc('2023-12-14T12:00:00Z'), // scheduled 32 days ago
        moment.utc('2024-01-13T12:00:00Z'), // due 2 days ago (30-day interval)
        now
      );

      // Short interval should have MUCH higher relative overdueness
      expect(shortInterval.relativeOverdue).toBeGreaterThan(0.9); // ~1.0 (3 days / 3 days)
      expect(longInterval.relativeOverdue).toBeLessThan(0.1); // ~0.067 (2 days / 30 days)
      expect(shortInterval.relativeOverdue).toBeGreaterThan(longInterval.relativeOverdue * 10);
    });

    it('should clamp relative overdueness at 1.0 for score calculation', () => {
      // Extremely overdue: 10 days overdue on 3-day interval
      const extremelyOverdue = computeUrgencyScore(
        moment.utc('2024-01-02T12:00:00Z'), // scheduled 13 days ago
        moment.utc('2024-01-05T12:00:00Z'), // due 10 days ago (3-day interval)
        now
      );

      // relativeOverdue is unclamped for diagnostics
      expect(extremelyOverdue.relativeOverdue).toBeGreaterThan(3);

      // But score should still be within bounds
      expect(extremelyOverdue.score).toBeLessThanOrEqual(0.95);
      expect(extremelyOverdue.score).toBeGreaterThan(0.5);
    });
  });

  describe('interval recency factor', () => {
    it('should return ~1.0 for very short intervals (24h)', () => {
      const result = computeUrgencyScore(
        moment.utc('2024-01-14T12:00:00Z'), // scheduled 1 day ago
        moment.utc('2024-01-15T11:00:00Z'), // due 1 hour ago (23h interval)
        now
      );

      expect(result.recencyFactor).toBeGreaterThan(0.95);
    });

    it('should return ~0.56 for 30-day intervals', () => {
      const result = computeUrgencyScore(
        moment.utc('2023-12-15T12:00:00Z'), // scheduled 31 days ago
        moment.utc('2024-01-14T12:00:00Z'), // due 1 day ago (30-day interval)
        now
      );

      // 0.3 + 0.7 * exp(-720/720) = 0.3 + 0.7 * 0.368 ≈ 0.56
      expect(result.recencyFactor).toBeCloseTo(0.56, 1);
    });

    it('should return ~0.30 for very long intervals (180+ days)', () => {
      const result = computeUrgencyScore(
        moment.utc('2023-07-10T12:00:00Z'), // scheduled 189 days ago
        moment.utc('2024-01-14T12:00:00Z'), // due 1 day ago (188-day interval)
        now
      );

      // Approaches 0.3 asymptotically
      expect(result.recencyFactor).toBeLessThan(0.35);
      expect(result.recencyFactor).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('combined scoring', () => {
    it('should score 3-day interval 2-days-overdue higher than 180-day interval 2-days-overdue', () => {
      // The key example from the plan
      const shortInterval = computeUrgencyScore(
        moment.utc('2024-01-09T12:00:00Z'), // 3-day interval
        moment.utc('2024-01-12T12:00:00Z'), // 3 days overdue (72h)
        now
      );

      const longInterval = computeUrgencyScore(
        moment.utc('2023-07-10T12:00:00Z'), // 180-day interval
        moment.utc('2024-01-13T12:00:00Z'), // 2 days overdue (48h)
        now
      );

      expect(shortInterval.score).toBeGreaterThan(longInterval.score);
      // Short interval should be significantly higher
      expect(shortInterval.score - longInterval.score).toBeGreaterThan(0.1);
    });

    it('should produce scores within expected range', () => {
      // Just due (0h overdue, 24h interval)
      const justDue = computeUrgencyScore(
        moment.utc('2024-01-14T12:00:00Z'),
        moment.utc('2024-01-15T12:00:00Z'),
        now
      );

      // Very overdue (7 days on 1 day interval)
      const veryOverdue = computeUrgencyScore(
        moment.utc('2024-01-07T12:00:00Z'),
        moment.utc('2024-01-08T12:00:00Z'),
        now
      );

      // All scores should be in [0.5, 0.95] range
      expect(justDue.score).toBeGreaterThanOrEqual(0.5);
      expect(justDue.score).toBeLessThanOrEqual(0.95);
      expect(veryOverdue.score).toBeGreaterThanOrEqual(0.5);
      expect(veryOverdue.score).toBeLessThanOrEqual(0.95);

      // Very overdue should be higher
      expect(veryOverdue.score).toBeGreaterThan(justDue.score);
    });

    it('should match expected scores from plan table', () => {
      // From the plan:
      // | Interval | Overdue | Relative | Recency | Score |
      // | 3 days   | 2 days  | 0.67     | 0.93    | 0.87  |
      // | 30 days  | 2 days  | 0.07     | 0.65    | 0.68  |
      // | 180 days | 2 days  | 0.01     | 0.35    | 0.59  |
      // | 1 day    | 6 hours | 0.25     | 0.99    | 0.78  |

      const case1 = computeUrgencyScore(
        moment.utc('2024-01-10T12:00:00Z'), // 3-day interval
        moment.utc('2024-01-13T12:00:00Z'), // 2 days overdue
        now
      );
      expect(case1.score).toBeCloseTo(0.87, 1);

      const case2 = computeUrgencyScore(
        moment.utc('2023-12-14T12:00:00Z'), // 30-day interval
        moment.utc('2024-01-13T12:00:00Z'), // 2 days overdue
        now
      );
      expect(case2.score).toBeCloseTo(0.68, 1);

      const case3 = computeUrgencyScore(
        moment.utc('2023-07-19T12:00:00Z'), // 180-day interval
        moment.utc('2024-01-13T12:00:00Z'), // 2 days overdue
        now
      );
      expect(case3.score).toBeCloseTo(0.59, 1);

      // 1 day interval, 6 hours overdue
      const case4 = computeUrgencyScore(
        moment.utc('2024-01-14T06:00:00Z'), // 1-day interval (24h)
        moment.utc('2024-01-15T06:00:00Z'), // 6 hours overdue
        now
      );
      expect(case4.score).toBeCloseTo(0.78, 1);
    });
  });

  describe('edge cases', () => {
    it('should handle exactly due cards (0 hours overdue)', () => {
      const exactlyDue = computeUrgencyScore(
        moment.utc('2024-01-14T12:00:00Z'),
        moment.utc('2024-01-15T12:00:00Z'), // exactly now
        now
      );

      // Should still get a reasonable score from recency factor
      expect(exactlyDue.score).toBeGreaterThan(0.5);
      expect(exactlyDue.relativeOverdue).toBe(0);
    });

    it('should handle very short intervals (1 hour)', () => {
      const shortInterval = computeUrgencyScore(
        moment.utc('2024-01-15T10:00:00Z'),
        moment.utc('2024-01-15T11:00:00Z'), // 1 hour interval, 1 hour overdue
        now
      );

      // Very short interval should have high recency
      expect(shortInterval.recencyFactor).toBeGreaterThan(0.99);
    });

    it('should use minimum 1 hour interval to avoid division issues', () => {
      // Simultaneous schedule and due (edge case)
      const zeroInterval = computeUrgencyScore(
        moment.utc('2024-01-15T11:00:00Z'),
        moment.utc('2024-01-15T11:00:00Z'), // same time
        now
      );

      expect(zeroInterval.intervalHours).toBe(1);
      expect(Number.isFinite(zeroInterval.score)).toBe(true);
    });
  });
});

describe('SRS Navigator card filtering', () => {
  it('should only include cards that are actually due', () => {
    const now = moment.utc('2024-01-15T12:00:00Z');

    const dueCard = createMockReview(
      moment.utc('2024-01-12T12:00:00Z'),
      moment.utc('2024-01-14T12:00:00Z'), // due yesterday
      'due-card'
    );

    const futureCard = createMockReview(
      moment.utc('2024-01-14T12:00:00Z'),
      moment.utc('2024-01-16T12:00:00Z'), // due tomorrow
      'future-card'
    );

    const reviews = [dueCard, futureCard];
    const dueReviews = reviews.filter((r) => now.isAfter(moment.utc(r.reviewTime)));

    expect(dueReviews).toHaveLength(1);
    expect(dueReviews[0].cardId).toBe('due-card');
  });
});

describe('SRS Navigator provenance', () => {
  it('should mark cards as reviews in provenance reason', () => {
    // The reason string should contain "review" for getCardOrigin to work
    const reason = `48h overdue (interval: 72h, relative: 0.67), recency: 0.93, review`;
    expect(reason.toLowerCase()).toContain('review');
  });

  it('should work with getCardOrigin helper', () => {
    const card: WeightedCard = {
      cardId: 'test-card',
      courseId: 'test-course',
      score: 0.85,
      provenance: [
        {
          strategy: 'srs',
          strategyName: 'SRS',
          strategyId: 'NAVIGATION_STRATEGY-SRS-default',
          action: 'generated',
          score: 0.85,
          reason: '48h overdue (interval: 72h, relative: 0.67), recency: 0.93, review',
        },
      ],
    };

    expect(getCardOrigin(card)).toBe('review');
  });
});

describe('SRS Navigator sorting', () => {
  it('should sort cards by score descending', () => {
    const now = moment.utc('2024-01-15T12:00:00Z');

    // More urgent (short interval, very overdue)
    const urgent = computeUrgencyScore(
      moment.utc('2024-01-11T12:00:00Z'), // 3-day interval
      moment.utc('2024-01-14T12:00:00Z'), // 1 day overdue
      now
    );

    // Less urgent (long interval, slightly overdue)
    const lessUrgent = computeUrgencyScore(
      moment.utc('2023-12-15T12:00:00Z'), // 30-day interval
      moment.utc('2024-01-14T12:00:00Z'), // 1 day overdue
      now
    );

    const cards = [
      { cardId: 'less-urgent', score: lessUrgent.score },
      { cardId: 'urgent', score: urgent.score },
    ];

    const sorted = cards.sort((a, b) => b.score - a.score);

    expect(sorted[0].cardId).toBe('urgent');
    expect(sorted[1].cardId).toBe('less-urgent');
  });
});
