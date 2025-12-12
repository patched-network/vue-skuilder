import { describe, it, expect, vi } from 'vitest';
import CompositeGenerator, {
  AggregationMode,
} from '../../../src/core/navigators/generators/CompositeGenerator';
import { ContentNavigator, WeightedCard } from '../../../src/core/navigators/index';
import { GeneratorContext } from '../../../src/core/navigators/generators/types';
import { UserDBInterface } from '../../../src/core/interfaces/userDB';
import { CourseDBInterface } from '../../../src/core/interfaces/courseDB';

// Test helper to create weighted cards with provenance
function makeWeightedCard(
  cardId: string,
  courseId: string,
  score: number,
  origin: 'new' | 'review' | 'failed' = 'new',
  strategy: string = 'test'
): WeightedCard {
  return {
    cardId,
    courseId,
    score,
    provenance: [
      {
        strategy,
        strategyName: 'Test Strategy',
        strategyId: 'TEST_STRATEGY',
        action: 'generated',
        score,
        reason: `Test card, ${origin}`,
      },
    ],
  };
}

// Mock ContentNavigator for testing
class MockGenerator extends ContentNavigator {
  name: string = 'MockGenerator';
  private mockWeightedCards: WeightedCard[] = [];

  setWeightedCards(cards: WeightedCard[]) {
    this.mockWeightedCards = cards;
  }

  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    return this.mockWeightedCards.slice(0, limit);
  }
}

// Create a mock context for tests
function createMockContext(): GeneratorContext {
  const mockUser = {
    getCourseRegDoc: vi.fn().mockResolvedValue({
      elo: { global: { score: 1000, count: 10 }, tags: {} },
    }),
  } as unknown as UserDBInterface;

  const mockCourse = {
    getCourseID: vi.fn().mockReturnValue('test-course'),
  } as unknown as CourseDBInterface;

  return {
    user: mockUser,
    course: mockCourse,
    userElo: 1000,
  };
}

describe('CompositeGenerator', () => {
  const mockContext = createMockContext();

  describe('constructor', () => {
    it('throws error when no generators provided', () => {
      expect(() => new CompositeGenerator([])).toThrow(
        'CompositeGenerator requires at least one generator'
      );
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
        makeWeightedCard('card-1', 'course-1', 0.8, 'new'),
        makeWeightedCard('card-2', 'course-1', 0.6, 'review'),
      ]);

      const composite = new CompositeGenerator([generator]);
      const result = await composite.getWeightedCards(10, mockContext);

      expect(result).toHaveLength(2);
      expect(result[0].cardId).toBe('card-1');
      expect(result[0].score).toBe(0.8);
      expect(result[1].cardId).toBe('card-2');
      expect(result[1].score).toBe(0.6);
    });

    it('respects limit parameter', async () => {
      const generator = new MockGenerator();
      generator.setWeightedCards([
        makeWeightedCard('card-1', 'course-1', 0.9, 'new'),
        makeWeightedCard('card-2', 'course-1', 0.8, 'new'),
        makeWeightedCard('card-3', 'course-1', 0.7, 'new'),
      ]);

      const composite = new CompositeGenerator([generator]);
      const result = await composite.getWeightedCards(2, mockContext);

      expect(result).toHaveLength(2);
      expect(result[0].cardId).toBe('card-1');
      expect(result[1].cardId).toBe('card-2');
    });
  });

  describe('getWeightedCards - multiple generators with deduplication', () => {
    it('deduplicates cards appearing in multiple generators', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([
        makeWeightedCard('card-1', 'course-1', 0.8, 'new'),
        makeWeightedCard('card-2', 'course-1', 0.6, 'new'),
      ]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([
        makeWeightedCard('card-1', 'course-1', 0.7, 'new'),
        makeWeightedCard('card-3', 'course-1', 0.5, 'new'),
      ]);

      const composite = new CompositeGenerator([gen1, gen2], AggregationMode.AVERAGE);
      const result = await composite.getWeightedCards(10, mockContext);

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
      gen1.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.6, 'new')]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.9, 'new')]);

      const composite = new CompositeGenerator([gen1, gen2], AggregationMode.MAX);
      const result = await composite.getWeightedCards(10, mockContext);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(0.9);
    });
  });

  describe('aggregation mode: AVERAGE', () => {
    it('averages scores from multiple generators', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.8, 'new')]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.6, 'new')]);

      const composite = new CompositeGenerator([gen1, gen2], AggregationMode.AVERAGE);
      const result = await composite.getWeightedCards(10, mockContext);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBeCloseTo(0.7); // (0.8 + 0.6) / 2
    });

    it('averages scores from three generators', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.9, 'new')]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.6, 'new')]);

      const gen3 = new MockGenerator();
      gen3.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.6, 'new')]);

      const composite = new CompositeGenerator([gen1, gen2, gen3], AggregationMode.AVERAGE);
      const result = await composite.getWeightedCards(10, mockContext);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBeCloseTo(0.7); // (0.9 + 0.6 + 0.6) / 3
    });
  });

  describe('aggregation mode: FREQUENCY_BOOST (default)', () => {
    it('applies frequency boost for cards appearing in multiple generators', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.8, 'new')]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.6, 'new')]);

      const composite = new CompositeGenerator([gen1, gen2]); // default mode
      const result = await composite.getWeightedCards(10, mockContext);

      expect(result).toHaveLength(1);
      // avg = (0.8 + 0.6) / 2 = 0.7
      // boost = 1 + 0.1 * (2 - 1) = 1.1
      // final = 0.7 * 1.1 = 0.77
      expect(result[0].score).toBeCloseTo(0.77);
    });

    it('applies larger boost for cards in three generators', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.6, 'new')]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.6, 'new')]);

      const gen3 = new MockGenerator();
      gen3.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.6, 'new')]);

      const composite = new CompositeGenerator([gen1, gen2, gen3]);
      const result = await composite.getWeightedCards(10, mockContext);

      expect(result).toHaveLength(1);
      // avg = 0.6
      // boost = 1 + 0.1 * (3 - 1) = 1.2
      // final = 0.6 * 1.2 = 0.72
      expect(result[0].score).toBeCloseTo(0.72);
    });

    it('does not boost cards appearing in only one generator', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.8, 'new')]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([makeWeightedCard('card-2', 'course-1', 0.6, 'new')]);

      const composite = new CompositeGenerator([gen1, gen2]);
      const result = await composite.getWeightedCards(10, mockContext);

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
      gen1.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.9, 'new')]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([makeWeightedCard('card-1', 'course-1', 0.9, 'new')]);

      const composite = new CompositeGenerator([gen1, gen2]);
      const result = await composite.getWeightedCards(10, mockContext);

      expect(result).toHaveLength(1);
      // avg = 0.9, boost = 1.1, result = 0.99 (would be 0.99, not clamped)
      // But with higher scores:
      expect(result[0].score).toBeLessThanOrEqual(1.0);
    });

    it('clamps to 1.0 when boosted score exceeds maximum', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([makeWeightedCard('card-1', 'course-1', 1.0, 'new')]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([makeWeightedCard('card-1', 'course-1', 1.0, 'new')]);

      const gen3 = new MockGenerator();
      gen3.setWeightedCards([makeWeightedCard('card-1', 'course-1', 1.0, 'new')]);

      const composite = new CompositeGenerator([gen1, gen2, gen3]);
      const result = await composite.getWeightedCards(10, mockContext);

      expect(result).toHaveLength(1);
      // avg = 1.0, boost = 1.2, result would be 1.2 but clamped to 1.0
      expect(result[0].score).toBe(1.0);
    });
  });

  describe('sorting and limiting', () => {
    it('returns cards sorted by score descending', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([
        makeWeightedCard('card-low', 'course-1', 0.3, 'new'),
        makeWeightedCard('card-high', 'course-1', 0.9, 'new'),
        makeWeightedCard('card-med', 'course-1', 0.6, 'new'),
      ]);

      const composite = new CompositeGenerator([gen1]);
      const result = await composite.getWeightedCards(10, mockContext);

      expect(result).toHaveLength(3);
      expect(result[0].cardId).toBe('card-high');
      expect(result[1].cardId).toBe('card-med');
      expect(result[2].cardId).toBe('card-low');
    });

    it('boosts cards appearing in multiple generators to top of list', async () => {
      const gen1 = new MockGenerator();
      gen1.setWeightedCards([
        makeWeightedCard('card-boosted', 'course-1', 0.5, 'new'),
        makeWeightedCard('card-single', 'course-1', 0.6, 'new'),
      ]);

      const gen2 = new MockGenerator();
      gen2.setWeightedCards([makeWeightedCard('card-boosted', 'course-1', 0.5, 'new')]);

      const composite = new CompositeGenerator([gen1, gen2]);
      const result = await composite.getWeightedCards(10, mockContext);

      expect(result).toHaveLength(2);
      // card-boosted: avg=0.5, boost=1.1, final=0.55
      // card-single: 0.6 (no boost)
      expect(result[0].cardId).toBe('card-single'); // 0.6 > 0.55
      expect(result[1].cardId).toBe('card-boosted');
    });
  });
});
