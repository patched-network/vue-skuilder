import { describe, it, expect } from 'vitest';
import CompositeGenerator, { AggregationMode } from '../../../src/core/navigators/CompositeGenerator';
import { ContentNavigator, WeightedCard } from '../../../src/core/navigators/index';
import { StudySessionNewItem, StudySessionReviewItem } from '../../../src/core';
import { ScheduledCard } from '../../../src/core/types/user';

// Mock ContentNavigator for testing
class MockGenerator extends ContentNavigator {
  private mockWeightedCards: WeightedCard[] = [];
  private mockNewCards: StudySessionNewItem[] = [];
  private mockReviews: (StudySessionReviewItem & ScheduledCard)[] = [];

  setWeightedCards(cards: WeightedCard[]) {
    this.mockWeightedCards = cards;
  }

  setNewCards(cards: StudySessionNewItem[]) {
    this.mockNewCards = cards;
  }

  setReviews(reviews: (StudySessionReviewItem & ScheduledCard)[]) {
    this.mockReviews = reviews;
  }

  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    return this.mockWeightedCards.slice(0, limit);
  }

  async getNewCards(n?: number): Promise<StudySessionNewItem[]> {
    return n ? this.mockNewCards.slice(0, n) : this.mockNewCards;
  }

  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    return this.mockReviews;
  }
}

describe('CompositeGenerator', () => {
  describe('constructor', () => {
    it('throws error when no generators provided', () => {
      expect(() => new CompositeGenerator([])).toThrow('CompositeGenerator requires at least one generator');
    });

    it('accepts single generator', () => {
      const generator = new MockGenerator();
      expect(() => new CompositeGenerator([generator])).not.toThrow();
    });

    it('accepts multiple generators', () => {
      const gen1 = new MockGenerator();
      const gen2 = new MockGenerator();
      expect(() => new CompositeGenerator([gen1, gen2])).not.toThrow();
    });
  });

  describe('getWeightedCards - single generator', () => {
    it('returns cards from single generator unchanged', async () => {
      const generator = new MockGenerator();
      generator.setWeightedCards([
        { cardId: 'card-1', courseId: 'course-1', score: 0.8, source: 'new' },
        { cardId: 'card-2', courseId: 'course-1', score: 0.6, source: 'review' },
      ]);

      const composite = new CompositeGenerator([generator]);
      const result = await composite.getWeightedCards(10);

      expect(result).toHaveLength(2);
      expect(result[0].cardId).toBe('card-1');
      expect(result[0].score).toBe(0.8);
      expect(result[1].cardId).toBe('card-2');
      expect(result[1].score).toBe(0.6);
    });

    it('respects limit parameter', async () => {
      const generator = new MockGenerator();
      generator.setWeightedCards([
        { cardId: 'card-1', courseId: 'course-1', score: 0.9, source: 'new' },
        { cardId: 'card-2', courseId: 'course-1', score: 0.8, source: 'new' },
        { cardId: 'card-3', courseId: 'course-1', score: 0.7, source: 'new' },
      ]);

      const composite = new CompositeGenerator([generator]);
      const result = await composite.getWeightedCards(2);

      expect(result).toHaveLength(2);
      expect(result[0].cardId).toBe('card-1');
      expect(result[1].cardId).toBe('card-2');
    });
  });

  describe('getWeightedCards - multiple generators with deduplication', () => {
    it('deduplicates cards appearing in multiple generators', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([
        { cardId: 'card-1', courseId: 'course-1', score: 0.8, source: 'new' },
        { cardId: 'card-2', courseId: 'course-1', score: 0.6, source: 'new' },
      ]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([
        { cardId: 'card-1', courseId: 'course-1', score: 0.7, source: 'new' },
        { cardId: 'card-3', courseId: 'course-1', score: 0.5, source: 'new' },
      ]);

      const composite = new CompositeGenerator([gen1, gen2], AggregationMode.AVERAGE);
      const result = await composite.getWeightedCards(10);

      // Should have 3 unique cards
      expect(result).toHaveLength(3);
      const cardIds = result.map((c) => c.cardId);
      expect(cardIds).toContain('card-1');
      expect(cardIds).toContain('card-2');
      expect(cardIds).toContain('card-3');
    });
  });

  describe('aggregation mode: MAX', () => {
    it('uses maximum score from any generator', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.6, source: 'new' }]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.9, source: 'new' }]);

      const composite = new CompositeGenerator([gen1, gen2], AggregationMode.MAX);
      const result = await composite.getWeightedCards(10);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(0.9);
    });
  });

  describe('aggregation mode: AVERAGE', () => {
    it('averages scores from multiple generators', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.8, source: 'new' }]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.6, source: 'new' }]);

      const composite = new CompositeGenerator([gen1, gen2], AggregationMode.AVERAGE);
      const result = await composite.getWeightedCards(10);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBeCloseTo(0.7); // (0.8 + 0.6) / 2
    });

    it('averages scores from three generators', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.9, source: 'new' }]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.6, source: 'new' }]);

      const gen3 = new MockGenerator();
      gen3.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.6, source: 'new' }]);

      const composite = new CompositeGenerator([gen1, gen2, gen3], AggregationMode.AVERAGE);
      const result = await composite.getWeightedCards(10);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBeCloseTo(0.7); // (0.9 + 0.6 + 0.6) / 3
    });
  });

  describe('aggregation mode: FREQUENCY_BOOST (default)', () => {
    it('applies frequency boost for cards appearing in multiple generators', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.8, source: 'new' }]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.6, source: 'new' }]);

      const composite = new CompositeGenerator([gen1, gen2]); // default mode
      const result = await composite.getWeightedCards(10);

      expect(result).toHaveLength(1);
      // avg = (0.8 + 0.6) / 2 = 0.7
      // boost = 1 + 0.1 * (2 - 1) = 1.1
      // final = 0.7 * 1.1 = 0.77
      expect(result[0].score).toBeCloseTo(0.77);
    });

    it('applies larger boost for cards in three generators', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.6, source: 'new' }]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.6, source: 'new' }]);

      const gen3 = new MockGenerator();
      gen3.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.6, source: 'new' }]);

      const composite = new CompositeGenerator([gen1, gen2, gen3]);
      const result = await composite.getWeightedCards(10);

      expect(result).toHaveLength(1);
      // avg = 0.6
      // boost = 1 + 0.1 * (3 - 1) = 1.2
      // final = 0.6 * 1.2 = 0.72
      expect(result[0].score).toBeCloseTo(0.72);
    });

    it('does not boost cards appearing in only one generator', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.8, source: 'new' }]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([{ cardId: 'card-2', courseId: 'course-1', score: 0.6, source: 'new' }]);

      const composite = new CompositeGenerator([gen1, gen2]);
      const result = await composite.getWeightedCards(10);

      expect(result).toHaveLength(2);
      // No boost for single-generator cards
      const card1 = result.find((c) => c.cardId === 'card-1');
      const card2 = result.find((c) => c.cardId === 'card-2');
      expect(card1!.score).toBe(0.8);
      expect(card2!.score).toBe(0.6);
    });
  });

  describe('score clamping', () => {
    it('clamps boosted scores to maximum of 1.0', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.9, source: 'new' }]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 0.9, source: 'new' }]);

      const composite = new CompositeGenerator([gen1, gen2]);
      const result = await composite.getWeightedCards(10);

      expect(result).toHaveLength(1);
      // avg = 0.9, boost = 1.1, result = 0.99 (would be 0.99, not clamped)
      // But with higher scores:
      expect(result[0].score).toBeLessThanOrEqual(1.0);
    });

    it('clamps to 1.0 when boosted score exceeds maximum', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 1.0, source: 'new' }]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 1.0, source: 'new' }]);

      const gen3 = new MockGenerator();
      gen3.setWeightedCards([{ cardId: 'card-1', courseId: 'course-1', score: 1.0, source: 'new' }]);

      const composite = new CompositeGenerator([gen1, gen2, gen3]);
      const result = await composite.getWeightedCards(10);

      expect(result).toHaveLength(1);
      // avg = 1.0, boost = 1.2, result would be 1.2 but clamped to 1.0
      expect(result[0].score).toBe(1.0);
    });
  });

  describe('sorting and limiting', () => {
    it('returns cards sorted by score descending', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([
        { cardId: 'card-low', courseId: 'course-1', score: 0.3, source: 'new' },
        { cardId: 'card-high', courseId: 'course-1', score: 0.9, source: 'new' },
        { cardId: 'card-med', courseId: 'course-1', score: 0.6, source: 'new' },
      ]);

      const composite = new CompositeGenerator([gen1]);
      const result = await composite.getWeightedCards(10);

      expect(result).toHaveLength(3);
      expect(result[0].cardId).toBe('card-high');
      expect(result[1].cardId).toBe('card-med');
      expect(result[2].cardId).toBe('card-low');
    });

    it('boosts cards appearing in multiple generators to top of list', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([
        { cardId: 'card-boosted', courseId: 'course-1', score: 0.5, source: 'new' },
        { cardId: 'card-single', courseId: 'course-1', score: 0.6, source: 'new' },
      ]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([
        { cardId: 'card-boosted', courseId: 'course-1', score: 0.5, source: 'new' },
      ]);

      const composite = new CompositeGenerator([gen1, gen2]);
      const result = await composite.getWeightedCards(10);

      expect(result).toHaveLength(2);
      // card-boosted: avg=0.5, boost=1.1, final=0.55
      // card-single: 0.6 (no boost)
      expect(result[0].cardId).toBe('card-single'); // 0.6 > 0.55
      expect(result[1].cardId).toBe('card-boosted');
    });
  });

  describe('getNewCards', () => {
    it('deduplicates new cards by cardID', async () => {
      const gen1 = new MockGenerator();
      gen1.setNewCards([
        {
          cardID: 'card-1',
          courseID: 'course-1',
          contentSourceType: 'course',
          contentSourceID: 'course-1',
          status: 'new',
        },
        {
          cardID: 'card-2',
          courseID: 'course-1',
          contentSourceType: 'course',
          contentSourceID: 'course-1',
          status: 'new',
        },
      ]);

      const gen2 = new MockGenerator();
      gen2.setNewCards([
        {
          cardID: 'card-1',
          courseID: 'course-1',
          contentSourceType: 'course',
          contentSourceID: 'course-1',
          status: 'new',
        },
        {
          cardID: 'card-3',
          courseID: 'course-1',
          contentSourceType: 'course',
          contentSourceID: 'course-1',
          status: 'new',
        },
      ]);

      const composite = new CompositeGenerator([gen1, gen2]);
      const result = await composite.getNewCards();

      expect(result).toHaveLength(3);
      const cardIds = result.map((c) => c.cardID);
      expect(cardIds).toContain('card-1');
      expect(cardIds).toContain('card-2');
      expect(cardIds).toContain('card-3');
    });

    it('respects limit parameter', async () => {
      const gen1 = new MockGenerator();
      gen1.setNewCards([
        {
          cardID: 'card-1',
          courseID: 'course-1',
          contentSourceType: 'course',
          contentSourceID: 'course-1',
          status: 'new',
        },
        {
          cardID: 'card-2',
          courseID: 'course-1',
          contentSourceType: 'course',
          contentSourceID: 'course-1',
          status: 'new',
        },
        {
          cardID: 'card-3',
          courseID: 'course-1',
          contentSourceType: 'course',
          contentSourceID: 'course-1',
          status: 'new',
        },
      ]);

      const composite = new CompositeGenerator([gen1]);
      const result = await composite.getNewCards(2);

      expect(result).toHaveLength(2);
    });
  });

  describe('getPendingReviews', () => {
    it('deduplicates reviews by cardID', async () => {
      const review1: StudySessionReviewItem & ScheduledCard = {
        cardID: 'card-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'review',
        reviewID: 'review-1',
        qualifiedID: 'course-1-card-1',
        _id: 'scheduled-1',
        cardId: 'card-1',
        courseId: 'course-1',
        scheduledFor: 'course',
        schedulingAgentId: 'agent-1',
      };

      const review2: StudySessionReviewItem & ScheduledCard = {
        cardID: 'card-2',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'review',
        reviewID: 'review-2',
        qualifiedID: 'course-1-card-2',
        _id: 'scheduled-2',
        cardId: 'card-2',
        courseId: 'course-1',
        scheduledFor: 'course',
        schedulingAgentId: 'agent-1',
      };

      const gen1 = new MockGenerator();
      gen1.setReviews([review1, review2]);

      const gen2 = new MockGenerator();
      gen2.setReviews([review1]); // Duplicate review1

      const composite = new CompositeGenerator([gen1, gen2]);
      const result = await composite.getPendingReviews();

      expect(result).toHaveLength(2);
      const cardIds = result.map((c) => c.cardID);
      expect(cardIds).toContain('card-1');
      expect(cardIds).toContain('card-2');
    });
  });
});
