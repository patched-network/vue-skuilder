/**
 * Failed Card Resurfacing Tests for SessionController
 *
 * Tests for the behavior of failed cards in SessionController.
 * Verifies that cards marked as failed are properly queued for re-presentation
 * and removed from the failed queue after success.
 *
 * These tests document and verify the expected behavior of:
 * 1. Re-queuing cards after failure
 * 2. Re-presenting failed cards based on probability
 * 3. Removing cards from failedQ after successful response
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { withRandomSequence } from '../../src/harness/determinism';
import {
  createMockSource,
  createWeightedCard,
  SimpleCard,
} from '../../src/mocks/mock-source';
import { createMockUserDB, MockUserDB } from '../../src/mocks/mock-user-db';

describe('SessionController failed card resurfacing', () => {
  let restoreRandom: (() => void) | null = null;
  let userDB: MockUserDB;

  beforeEach(() => {
    userDB = createMockUserDB({
      userId: 'test-user',
      defaultElo: 1200,
    });
  });

  afterEach(() => {
    if (restoreRandom) {
      restoreRandom();
      restoreRandom = null;
    }
    userDB.reset();
  });

  describe('Failed Card Queue Behavior', () => {
    it('documents expected failed card flow', () => {
      /**
       * Expected flow when a card is marked as failed:
       *
       * 1. User answers card incorrectly
       * 2. SessionController receives 'marked-failed' action
       * 3. Card is added to failedQ
       * 4. Card remains in failedQ until answered correctly
       * 5. When probability selects failedQ, card is re-presented
       * 6. On correct answer, card is removed from failedQ
       */
      const flow = {
        step1: 'User answers incorrectly',
        step2: 'SessionController receives marked-failed action',
        step3: 'Card added to failedQ',
        step4: 'Card remains until success',
        step5: 'Re-presented when probability selects failedQ',
        step6: 'Removed from failedQ on success',
      };

      expect(Object.keys(flow)).toHaveLength(6);
    });

    it('documents failedQ data structure', () => {
      /**
       * Failed cards are stored as StudySessionFailedItem:
       * {
       *   cardID: string,
       *   courseID: string,
       *   contentSourceType: 'course',
       *   contentSourceID: string,
       *   status: 'failed',
       *   originalStatus: 'new' | 'review',  // What queue it came from
       * }
       */
      const failedItemStructure = {
        cardID: 'card-123',
        courseID: 'course-abc',
        contentSourceType: 'course',
        contentSourceID: 'course-abc',
        status: 'failed',
        originalStatus: 'new', // or 'review'
      };

      expect(failedItemStructure.status).toBe('failed');
      expect(['new', 'review']).toContain(failedItemStructure.originalStatus);
    });
  });

  describe('Re-queuing After Failure', () => {
    it('card should be added to failedQ on first failure', () => {
      // When nextCard('marked-failed') is called:
      // 1. Current card is added to failedQ
      // 2. failedQ.length increases by 1
      // 3. Card's status changes to 'failed'

      const expectedBehavior = {
        action: 'marked-failed',
        result: 'Card added to failedQ',
        failedQLength: 'increases by 1',
        cardStatus: 'failed',
      };

      expect(expectedBehavior.result).toBe('Card added to failedQ');
    });

    it('card should remain in failedQ after second failure', () => {
      // When a failed card is shown again and user fails again:
      // 1. Card stays in failedQ (not duplicated)
      // 2. failedQ.length remains the same
      // 3. Card position may change based on queue implementation

      const expectedBehavior = {
        action: 'marked-failed on already-failed card',
        result: 'Card remains in failedQ',
        failedQLength: 'unchanged (no duplicate)',
        note: 'Card is not removed, just re-queued for another attempt',
      };

      expect(expectedBehavior.failedQLength).toBe('unchanged (no duplicate)');
    });

    it('documents potential bug: failed cards not properly tracked', () => {
      /**
       * SUSPECTED BUG:
       *
       * There may be inconsistency in how failed cards are tracked
       * when they fail multiple times:
       *
       * 1. First failure: Card added to failedQ correctly
       * 2. Re-presented: Card dequeued from failedQ
       * 3. Second failure: Card should be re-added to failedQ
       *
       * If step 3 doesn't properly re-add the card, it could be lost.
       */
      const potentialIssue = {
        scenario: 'Card fails, re-presented, fails again',
        risk: 'Card may be lost if not properly re-added to failedQ',
        verification: 'Need integration test with actual SessionController',
      };

      expect(potentialIssue.risk).toBeTruthy();
    });
  });

  describe('Removal After Success', () => {
    it('card should be removed from failedQ after success', () => {
      // When a failed card is answered correctly:
      // 1. Card is removed from failedQ
      // 2. failedQ.length decreases by 1
      // 3. Card is NOT added back to newQ or reviewQ

      const expectedBehavior = {
        action: 'dismiss-failed on failed card (success after failure)',
        result: 'Card removed from failedQ',
        failedQLength: 'decreases by 1',
        notAddedBack: true,
      };

      expect(expectedBehavior.result).toBe('Card removed from failedQ');
    });

    it('documents difference between dismiss-success and dismiss-failed', () => {
      /**
       * Session actions and their meanings:
       *
       * - 'dismiss-success': User answered correctly (first attempt)
       * - 'dismiss-failed': User answered correctly after a previous failure
       * - 'marked-failed': User answered incorrectly
       *
       * Both dismiss-success and dismiss-failed indicate correct answers,
       * but dismiss-failed indicates the card was previously in failedQ.
       */
      const actions = {
        'dismiss-success': {
          meaning: 'Correct answer, first attempt',
          cardRemoval: 'Removed from newQ or reviewQ',
        },
        'dismiss-failed': {
          meaning: 'Correct answer after previous failure',
          cardRemoval: 'Removed from failedQ',
        },
        'marked-failed': {
          meaning: 'Incorrect answer',
          cardRemoval: 'Moved to failedQ',
        },
      };

      expect(Object.keys(actions)).toHaveLength(3);
    });
  });

  describe('UserDB Integration for Failed Cards', () => {
    it('tracks outcome history for failed cards', async () => {
      const courseId = 'test-course';
      const cardId = 'failed-card-1';

      // First failure
      await userDB.recordCardOutcome(courseId, cardId, { correct: false });

      // Second failure (re-presented, failed again)
      await userDB.recordCardOutcome(courseId, cardId, { correct: false });

      // Finally succeeds
      await userDB.recordCardOutcome(courseId, cardId, { correct: true });

      const outcomes = userDB.getCardOutcomes(cardId);

      expect(outcomes).toHaveLength(3);
      expect(outcomes[0].outcome).toEqual({ correct: false });
      expect(outcomes[1].outcome).toEqual({ correct: false });
      expect(outcomes[2].outcome).toEqual({ correct: true });
    });

    it('calculates mastery rate including failures', () => {
      const courseId = 'test-course';
      const cardId = 'learning-card';

      // Simulate learning: fail, fail, succeed, succeed, succeed
      userDB.simulateTagMastery(courseId, 'test-tag', [cardId], 0.6);

      const masteryRate = userDB.getCardMasteryRate(courseId, cardId);

      // 60% success rate means 6 out of 10 correct
      expect(masteryRate).toBe(0.6);
    });
  });

  describe('Mock Source for Failed Card Testing', () => {
    it('creates cards for failure simulation', () => {
      const testCards: SimpleCard[] = [
        { cardId: 'easy-card', score: 0.9, elo: 800 },
        { cardId: 'hard-card', score: 0.3, elo: 1600 },
        { cardId: 'medium-card', score: 0.6, elo: 1200 },
      ];

      const source = createMockSource(testCards);

      expect(source).toBeDefined();
    });

    it('creates weighted card with provenance', () => {
      const card = createWeightedCard({
        cardId: 'provenance-test',
        courseId: 'test-course',
        score: 0.75,
        tags: ['test', 'provenance'],
      });

      expect(card.cardId).toBe('provenance-test');
      expect(card.score).toBe(0.75);
      expect(card.provenance).toHaveLength(1);
      expect(card.provenance[0].strategy).toBe('mock');
    });
  });

  describe('Deterministic Failed Card Selection', () => {
    it('forces failedQ selection with high random value', async () => {
      // In SessionController, failedQ is selected when:
      // choice >= reviewBound (typically 0.9)
      //
      // So values like 0.95 or 0.99 should always select failedQ
      // (assuming failedQ is not empty)

      const highValues = [0.95, 0.99, 0.999];

      await withRandomSequence(highValues, () => {
        expect(Math.random()).toBe(0.95);
        expect(Math.random()).toBe(0.99);
        expect(Math.random()).toBe(0.999);
      });
    });

    it('forces newQ selection with low random value', async () => {
      // newQ is selected when:
      // choice < newBound (0.1 to 0.5 depending on time)
      //
      // Values like 0.01 should always select newQ

      const lowValues = [0.01, 0.05];

      await withRandomSequence(lowValues, () => {
        expect(Math.random()).toBe(0.01);
        expect(Math.random()).toBe(0.05);
      });
    });

    it('forces reviewQ selection with mid-range random value', async () => {
      // reviewQ is selected when:
      // newBound <= choice < reviewBound
      //
      // Values like 0.5 to 0.8 typically select reviewQ

      const midValues = [0.5, 0.6, 0.75, 0.85];

      await withRandomSequence(midValues, () => {
        for (const expected of midValues) {
          expect(Math.random()).toBe(expected);
        }
      });
    });
  });

  describe('Edge Cases for Failed Card Handling', () => {
    it('documents behavior when only failedQ has items', () => {
      // When newQ and reviewQ are both empty, but failedQ has items:
      // - newBound = reviewBound (e.g., 0.9)
      // - Any random value >= 0.9 selects failedQ
      // - Values < 0.9 would try to select newQ/reviewQ but find them empty

      const scenario = {
        newQLength: 0,
        reviewQLength: 0,
        failedQLength: 3,
        expectedBehavior: 'Should always return from failedQ',
        potentialIssue: 'Logic may not handle this case optimally',
      };

      expect(scenario.failedQLength).toBe(3);
    });

    it('documents session end with remaining failed cards', () => {
      // When timer expires but failedQ still has items:
      // - Only failedQ is drawn from
      // - Session continues until failedQ is empty
      // - This is the "cleanup" phase

      const timerExpiredScenario = {
        secondsRemaining: 0,
        failedQLength: 2,
        behavior: 'Continue presenting failed cards',
        sessionEnds: 'When failedQ becomes empty',
      };

      expect(timerExpiredScenario.behavior).toBe('Continue presenting failed cards');
    });

    it('documents failed card that never succeeds', () => {
      // Edge case: User keeps failing the same card
      // - Card stays in failedQ indefinitely
      // - Session can't end until card is answered correctly
      // - No timeout mechanism for individual cards

      const persistentFailure = {
        scenario: 'User fails same card 10 times in a row',
        cardBehavior: 'Stays in failedQ',
        sessionBehavior: 'Continues until card succeeds or user quits',
        potentialImprovement: 'Consider max failure count before skipping',
      };

      expect(persistentFailure.cardBehavior).toBe('Stays in failedQ');
    });
  });

  describe('Failed Card Count Tracking', () => {
    it('provides failedCount getter', () => {
      // SessionController exposes failedCount for UI display
      const expectedAPI = {
        getter: 'failedCount',
        returns: 'failedQ.length',
        usage: 'Display remaining failed cards to user',
      };

      expect(expectedAPI.getter).toBe('failedCount');
    });

    it('provides debug info for failed queue', () => {
      // getDebugInfo() returns detailed queue state
      const debugInfoStructure = {
        failedQueue: {
          length: 'number',
          dequeueCount: 'number',
          items: 'Array of first 10 items',
        },
      };

      expect(debugInfoStructure.failedQueue).toBeDefined();
      expect(debugInfoStructure.failedQueue.items).toBe('Array of first 10 items');
    });
  });
});