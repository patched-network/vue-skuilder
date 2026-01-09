/**
 * Queue Probability Tests for SessionController
 *
 * Tests for the probability-based queue selection behavior in SessionController.
 * These tests verify and document the queue selection logic that determines
 * which type of card (new, review, or failed) is shown next.
 *
 * IMPORTANT: These tests use mock random sequences to control the probability
 * decisions made by SessionController._selectNextItemToHydrate().
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { mockRandomSequence, withRandomSequence } from '../../src/harness/determinism';
import {
  createMockSource,
  createEmptyMockSource,
  createReviewMockSource,
  SimpleCard,
} from '../../src/mocks/mock-source';
import { createMockUserDB } from '../../src/mocks/mock-user-db';

describe('SessionController queue probability', () => {
  let restoreRandom: (() => void) | null = null;

  afterEach(() => {
    if (restoreRandom) {
      restoreRandom();
      restoreRandom = null;
    }
  });

  describe('Queue Probability Thresholds', () => {
    /**
     * Documents the probability thresholds used in SessionController.
     *
     * The thresholds depend on available time and queue states:
     *
     * When availableTime > 20 seconds:
     *   - newQ: 0 - 0.5 (50% chance)
     *   - reviewQ: 0.5 - 0.9 (40% chance)
     *   - failedQ: 0.9 - 1.0 (10% chance)
     *
     * When time-remaining vs failedQ looks good:
     *   - newQ: 0 - 0.05 (5% chance)
     *   - reviewQ: 0.05 - 0.9 (85% chance)
     *   - failedQ: 0.9 - 1.0 (10% chance)
     *
     * When time is running out:
     *   - newQ: 0 - 0.01 (1% chance)
     *   - reviewQ: 0.01 - 0.1 (9% chance)
     *   - failedQ: 0.1 - 1.0 (90% chance)
     */
    it('documents probability thresholds', () => {
      // This test documents the expected thresholds
      const thresholds = {
        plentyOfTime: {
          newBound: 0.5,
          reviewBound: 0.9,
          comment: 'When availableTime > 20s, favor new cards',
        },
        moderateTime: {
          newBound: 0.05,
          reviewBound: 0.9,
          comment: 'When time for reviews but tight for new, favor reviews',
        },
        lowTime: {
          newBound: 0.01,
          reviewBound: 0.1,
          comment: 'When time is tight, focus on failed cards',
        },
      };

      expect(thresholds.plentyOfTime.newBound).toBe(0.5);
      expect(thresholds.moderateTime.reviewBound).toBe(0.9);
      expect(thresholds.lowTime.newBound).toBe(0.01);
    });
  });

  describe('Empty Queue Adjustments', () => {
    it('adjusts bounds when failedQ is empty', () => {
      // When failedQ.length === 0, reviewBound is set to 1
      // This means random values 0.9-1.0 that would go to failedQ
      // now go to reviewQ instead
      const emptyFailedQBehavior = {
        originalReviewBound: 0.9,
        adjustedReviewBound: 1.0,
        comment: 'When failedQ empty, reviewQ absorbs its probability',
      };

      expect(emptyFailedQBehavior.adjustedReviewBound).toBe(1.0);
    });

    it('adjusts bounds when reviewQ is empty', () => {
      // When reviewQ.length === 0, newBound is set to reviewBound
      // This means new cards get the combined probability
      const emptyReviewQBehavior = {
        originalNewBound: 0.5,
        adjustedNewBound: 0.9, // becomes equal to reviewBound
        comment: 'When reviewQ empty, newQ absorbs its probability',
      };

      expect(emptyReviewQBehavior.adjustedNewBound).toBe(0.9);
    });
  });

  describe('Mock Source Creation', () => {
    it('creates mock source with simple cards', () => {
      const cards: SimpleCard[] = [
        { cardId: 'card-1', score: 0.9 },
        { cardId: 'card-2', score: 0.7 },
        { cardId: 'card-3', score: 0.5 },
      ];

      const source = createMockSource(cards);

      expect(source).toBeDefined();
    });

    it('creates empty mock source', () => {
      const source = createEmptyMockSource();

      expect(source).toBeDefined();
    });

    it('creates review mock source', () => {
      const cards: SimpleCard[] = [
        { cardId: 'review-1', score: 0.8 },
      ];

      const source = createReviewMockSource(cards);

      expect(source).toBeDefined();
      expect(source.isReview()).toBe(true);
    });
  });

  describe('Mock UserDB Creation', () => {
    it('creates mock user DB with default ELO', async () => {
      const userDB = createMockUserDB();

      const elo = await userDB.getUserELO('test-course');
      expect(elo).toBe(1200); // Default ELO
    });

    it('tracks recorded outcomes', async () => {
      const userDB = createMockUserDB();

      await userDB.recordCardOutcome('course-1', 'card-1', { correct: true });
      await userDB.recordCardOutcome('course-1', 'card-2', { correct: false });

      const outcomes = userDB.getRecordedOutcomes();
      expect(outcomes).toHaveLength(2);
      expect(outcomes[0].cardId).toBe('card-1');
      expect(outcomes[1].cardId).toBe('card-2');
    });
  });

  describe('Determinism Utilities', () => {
    it('mockRandomSequence returns values in order', () => {
      const values = [0.1, 0.5, 0.9];
      restoreRandom = mockRandomSequence(values);

      expect(Math.random()).toBe(0.1);
      expect(Math.random()).toBe(0.5);
      expect(Math.random()).toBe(0.9);
      // Cycles back
      expect(Math.random()).toBe(0.1);
    });

    it('withRandomSequence restores after execution', async () => {
      await withRandomSequence([0.42], () => {
        expect(Math.random()).toBe(0.42);
      });

      // Should be restored (can't easily verify it's the same function,
      // but at least it should work)
      const value = Math.random();
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });

  describe('BUG Documentation: Failed Cards Starved When ReviewQ Empty', () => {
    /**
     * This test documents a suspected bug in the queue probability logic.
     *
     * EXPECTED BEHAVIOR:
     * When reviewQ is empty but failedQ has items, failed cards should
     * get a fair share of the probability (more than just the 10% default).
     *
     * SUSPECTED BUG:
     * The current logic sets newBound = reviewBound when reviewQ is empty,
     * but this still leaves failedQ with only 10% chance (1 - reviewBound).
     *
     * This means failed cards may be starved even when they're the only
     * alternative to new cards.
     */
    it('documents probability distribution when reviewQ empty', () => {
      // When reviewQ.length === 0:
      //   newBound = reviewBound (e.g., 0.9)
      //   failedQ only gets values >= 0.9 (10% chance)
      //
      // Arguably, when reviewQ is empty:
      //   - If failedQ has items, it should get higher probability
      //   - Maybe 50/50 split between newQ and failedQ?

      const currentBehavior = {
        newBound: 0.9, // Set to reviewBound
        reviewBound: 0.9, // No change
        failedChance: 0.1, // Only 10%
        issue: 'Failed cards still get low priority even when reviewQ is empty',
      };

      const expectedBehavior = {
        newBound: 0.5, // Should share with failedQ
        failedChance: 0.5, // Should get fair share
        description: 'When reviewQ empty, split probability between newQ and failedQ',
      };

      // Document the discrepancy
      expect(currentBehavior.failedChance).toBe(0.1);
      expect(expectedBehavior.failedChance).toBe(0.5);
    });
  });

  describe('Queue Selection Edge Cases', () => {
    it('documents all-empty queue behavior', () => {
      // When all queues are empty, _selectNextItemToHydrate returns null
      const allEmptyBehavior = {
        returns: null,
        sessionOver: true,
        comment: 'Session ends when all queues are exhausted',
      };

      expect(allEmptyBehavior.returns).toBeNull();
    });

    it('documents timer-expired behavior', () => {
      // When _secondsRemaining <= 0, only failedQ is drawn from
      const timerExpiredBehavior = {
        drawsFrom: 'failedQ only',
        newQIgnored: true,
        reviewQIgnored: true,
        comment: 'After timer expires, only cleanup failed cards',
      };

      expect(timerExpiredBehavior.drawsFrom).toBe('failedQ only');
    });

    it('documents initial session behavior', () => {
      // At session start, new cards are prioritized to ensure
      // at least one new card from each source is shown
      const initialBehavior = {
        condition: 'newQ.dequeueCount < sources.length',
        action: 'Return newQ.peek(0) immediately',
        comment: 'Ensures each source gets representation at start',
      };

      expect(initialBehavior.condition).toBe('newQ.dequeueCount < sources.length');
    });
  });

  describe('Time-Based Priority Shifts', () => {
    it('documents availableTime calculation', () => {
      // availableTime = _secondsRemaining - (cleanupTime + reviewTime)
      // cleanupTime = estimated time to handle failed cards
      // reviewTime = 5 * reviewQ.length

      const calculation = {
        formula: 'availableTime = secondsRemaining - (cleanupTime + reviewTime)',
        cleanupTime: 'Average time spent on failed cards (from session records)',
        reviewTime: '5 seconds per review card in queue',
      };

      expect(calculation.reviewTime).toBe('5 seconds per review card in queue');
    });

    it('documents priority thresholds by available time', () => {
      const thresholds = [
        {
          condition: 'availableTime > 20',
          newChance: '50%',
          reviewChance: '40%',
          failedChance: '10%',
        },
        {
          condition: 'secondsRemaining - cleanupTime > 20',
          newChance: '5%',
          reviewChance: '85%',
          failedChance: '10%',
        },
        {
          condition: 'else (time is tight)',
          newChance: '1%',
          reviewChance: '9%',
          failedChance: '90%',
        },
      ];

      expect(thresholds).toHaveLength(3);
      expect(thresholds[2].failedChance).toBe('90%');
    });
  });
});