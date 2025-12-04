import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pipeline } from '../../../src/core/navigators/Pipeline';
import { WeightedCard, ContentNavigator } from '../../../src/core/navigators/index';
import { CardFilter, FilterContext } from '../../../src/core/navigators/filters/types';
import { StudySessionNewItem, StudySessionReviewItem } from '../../../src/core/interfaces/contentSource';
import { ScheduledCard } from '../../../src/core/types/user';
import { CourseDBInterface } from '../../../src/core/interfaces/courseDB';
import { UserDBInterface } from '../../../src/core/interfaces/userDB';

// ============================================================================
// MOCK IMPLEMENTATIONS
// ============================================================================

/**
 * Mock generator that returns predefined weighted cards
 */
class MockGenerator extends ContentNavigator {
  private cards: WeightedCard[];

  constructor(cards: WeightedCard[]) {
    super();
    this.cards = cards;
  }

  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    return this.cards.slice(0, limit);
  }

  async getNewCards(_n?: number): Promise<StudySessionNewItem[]> {
    return [];
  }

  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    return [];
  }
}

/**
 * Create a mock filter that multiplies scores by a fixed factor
 */
function createMultiplierFilter(name: string, multiplier: number): CardFilter {
  return {
    name,
    async transform(cards: WeightedCard[], _context: FilterContext): Promise<WeightedCard[]> {
      return cards.map((card) => ({
        ...card,
        score: card.score * multiplier,
        provenance: [
          ...card.provenance,
          {
            strategy: name.toLowerCase().replace(/\s+/g, '-'),
            strategyName: name,
            strategyId: `FILTER-${name.toUpperCase()}`,
            action: multiplier < 1 ? 'penalized' : multiplier > 1 ? 'boosted' : 'passed',
            score: card.score * multiplier,
            reason: `Multiplied by ${multiplier}`,
          },
        ],
      }));
    },
  };
}

/**
 * Create a mock filter that zeros out specific cards
 */
function createBlockingFilter(name: string, blockedCardIds: string[]): CardFilter {
  return {
    name,
    async transform(cards: WeightedCard[], _context: FilterContext): Promise<WeightedCard[]> {
      return cards.map((card) => {
        const blocked = blockedCardIds.includes(card.cardId);
        return {
          ...card,
          score: blocked ? 0 : card.score,
          provenance: [
            ...card.provenance,
            {
              strategy: 'blocker',
              strategyName: name,
              strategyId: `FILTER-BLOCKER`,
              action: blocked ? 'penalized' : 'passed',
              score: blocked ? 0 : card.score,
              reason: blocked ? 'Blocked' : 'Passed',
            },
          ],
        };
      });
    },
  };
}

/**
 * Create mock user and course interfaces
 */
function createMockContext(): { user: UserDBInterface; course: CourseDBInterface } {
  const mockUser = {
    getCourseRegDoc: vi.fn().mockResolvedValue({
      elo: { global: { score: 1000, count: 10 }, tags: {} },
    }),
  } as unknown as UserDBInterface;

  const mockCourse = {
    getCourseID: vi.fn().mockReturnValue('test-course'),
  } as unknown as CourseDBInterface;

  return { user: mockUser, course: mockCourse };
}

/**
 * Helper to create a weighted card
 */
function createCard(id: string, score: number): WeightedCard {
  return {
    cardId: id,
    courseId: 'test-course',
    score,
    provenance: [
      {
        strategy: 'test-generator',
        strategyName: 'Test Generator',
        strategyId: 'TEST_GENERATOR',
        action: 'generated',
        score,
        reason: 'Test card, new',
      },
    ],
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Pipeline', () => {
  let mockUser: UserDBInterface;
  let mockCourse: CourseDBInterface;

  beforeEach(() => {
    const context = createMockContext();
    mockUser = context.user;
    mockCourse = context.course;
  });

  describe('basic functionality', () => {
    it('should return cards from generator when no filters', async () => {
      const cards = [createCard('card-1', 0.8), createCard('card-2', 0.6)];
      const generator = new MockGenerator(cards);
      const pipeline = new Pipeline(generator, [], mockUser, mockCourse);

      const result = await pipeline.getWeightedCards(10);

      expect(result).toHaveLength(2);
      expect(result[0].cardId).toBe('card-1');
      expect(result[1].cardId).toBe('card-2');
    });

    it('should sort cards by score descending', async () => {
      const cards = [
        createCard('low', 0.3),
        createCard('high', 0.9),
        createCard('mid', 0.6),
      ];
      const generator = new MockGenerator(cards);
      const pipeline = new Pipeline(generator, [], mockUser, mockCourse);

      const result = await pipeline.getWeightedCards(10);

      expect(result[0].cardId).toBe('high');
      expect(result[1].cardId).toBe('mid');
      expect(result[2].cardId).toBe('low');
    });

    it('should respect limit parameter', async () => {
      const cards = [
        createCard('card-1', 0.9),
        createCard('card-2', 0.8),
        createCard('card-3', 0.7),
        createCard('card-4', 0.6),
      ];
      const generator = new MockGenerator(cards);
      const pipeline = new Pipeline(generator, [], mockUser, mockCourse);

      const result = await pipeline.getWeightedCards(2);

      expect(result).toHaveLength(2);
      expect(result[0].cardId).toBe('card-1');
      expect(result[1].cardId).toBe('card-2');
    });

    it('should return empty array when generator returns no cards', async () => {
      const generator = new MockGenerator([]);
      const pipeline = new Pipeline(generator, [], mockUser, mockCourse);

      const result = await pipeline.getWeightedCards(10);

      expect(result).toHaveLength(0);
    });
  });

  describe('filter application', () => {
    it('should apply single filter to all cards', async () => {
      const cards = [createCard('card-1', 1.0), createCard('card-2', 0.8)];
      const generator = new MockGenerator(cards);
      const filter = createMultiplierFilter('Half', 0.5);
      const pipeline = new Pipeline(generator, [filter], mockUser, mockCourse);

      const result = await pipeline.getWeightedCards(10);

      expect(result[0].score).toBe(0.5); // 1.0 * 0.5
      expect(result[1].score).toBe(0.4); // 0.8 * 0.5
    });

    it('should apply multiple filters sequentially', async () => {
      const cards = [createCard('card-1', 1.0)];
      const generator = new MockGenerator(cards);
      const filter1 = createMultiplierFilter('Half', 0.5);
      const filter2 = createMultiplierFilter('Double', 2.0);
      const pipeline = new Pipeline(generator, [filter1, filter2], mockUser, mockCourse);

      const result = await pipeline.getWeightedCards(10);

      // 1.0 * 0.5 * 2.0 = 1.0
      expect(result[0].score).toBe(1.0);
    });

    it('should remove zero-score cards after filtering', async () => {
      const cards = [
        createCard('keep', 0.8),
        createCard('block', 0.9),
      ];
      const generator = new MockGenerator(cards);
      const filter = createBlockingFilter('Blocker', ['block']);
      const pipeline = new Pipeline(generator, [filter], mockUser, mockCourse);

      const result = await pipeline.getWeightedCards(10);

      expect(result).toHaveLength(1);
      expect(result[0].cardId).toBe('keep');
    });

    it('should accumulate provenance from all filters', async () => {
      const cards = [createCard('card-1', 1.0)];
      const generator = new MockGenerator(cards);
      const filter1 = createMultiplierFilter('Filter A', 0.9);
      const filter2 = createMultiplierFilter('Filter B', 0.8);
      const pipeline = new Pipeline(generator, [filter1, filter2], mockUser, mockCourse);

      const result = await pipeline.getWeightedCards(10);

      expect(result[0].provenance).toHaveLength(3); // generator + 2 filters
      expect(result[0].provenance[0].strategyName).toBe('Test Generator');
      expect(result[0].provenance[1].strategyName).toBe('Filter A');
      expect(result[0].provenance[2].strategyName).toBe('Filter B');
    });
  });

  describe('filter order independence (multipliers)', () => {
    it('should produce same final score regardless of filter order', async () => {
      const cards = [createCard('card-1', 1.0)];

      const filterA = createMultiplierFilter('A', 0.5);
      const filterB = createMultiplierFilter('B', 0.8);

      // Order: A then B
      const generator1 = new MockGenerator([...cards]);
      const pipeline1 = new Pipeline(generator1, [filterA, filterB], mockUser, mockCourse);
      const result1 = await pipeline1.getWeightedCards(10);

      // Order: B then A
      const generator2 = new MockGenerator([...cards]);
      const pipeline2 = new Pipeline(generator2, [filterB, filterA], mockUser, mockCourse);
      const result2 = await pipeline2.getWeightedCards(10);

      // Both should yield 1.0 * 0.5 * 0.8 = 0.4
      expect(result1[0].score).toBeCloseTo(0.4);
      expect(result2[0].score).toBeCloseTo(0.4);
    });
  });

  describe('context building', () => {
    it('should pass context to filters', async () => {
      const cards = [createCard('card-1', 0.8)];
      const generator = new MockGenerator(cards);

      let capturedContext: FilterContext | null = null;
      const contextCapturingFilter: CardFilter = {
        name: 'Context Capturer',
        async transform(cards, context) {
          capturedContext = context;
          return cards;
        },
      };

      const pipeline = new Pipeline(generator, [contextCapturingFilter], mockUser, mockCourse);
      await pipeline.getWeightedCards(10);

      expect(capturedContext).not.toBeNull();
      expect(capturedContext!.user).toBe(mockUser);
      expect(capturedContext!.course).toBe(mockCourse);
      expect(capturedContext!.userElo).toBe(1000);
    });

    it('should use default ELO when user registration fails', async () => {
      const cards = [createCard('card-1', 0.8)];
      const generator = new MockGenerator(cards);

      const failingUser = {
        getCourseRegDoc: vi.fn().mockRejectedValue(new Error('Not registered')),
      } as unknown as UserDBInterface;

      let capturedElo = 0;
      const eloCapturingFilter: CardFilter = {
        name: 'ELO Capturer',
        async transform(cards, context) {
          capturedElo = context.userElo;
          return cards;
        },
      };

      const pipeline = new Pipeline(generator, [eloCapturingFilter], failingUser, mockCourse);
      await pipeline.getWeightedCards(10);

      expect(capturedElo).toBe(1000); // Default ELO
    });
  });

  describe('legacy API compatibility', () => {
    it('should delegate getNewCards to generator', async () => {
      const mockNewCards: StudySessionNewItem[] = [
        {
          cardID: 'new-1',
          courseID: 'test-course',
          contentSourceType: 'course',
          contentSourceID: 'test-course',
          status: 'new',
        },
      ];

      const generator = new MockGenerator([]);
      generator.getNewCards = vi.fn().mockResolvedValue(mockNewCards);

      const pipeline = new Pipeline(generator, [], mockUser, mockCourse);
      const result = await pipeline.getNewCards(10);

      expect(generator.getNewCards).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockNewCards);
    });

    it('should delegate getPendingReviews to generator', async () => {
      const mockReviews: (StudySessionReviewItem & ScheduledCard)[] = [
        {
          cardID: 'review-1',
          courseID: 'test-course',
          contentSourceType: 'course',
          contentSourceID: 'test-course',
          status: 'review',
          qualifiedID: 'test-course-review-1',
          reviewID: 'SCHEDULED_CARD-review-1',
          _id: 'SCHEDULED_CARD-review-1',
          cardId: 'review-1',
          courseId: 'test-course',
          reviewTime: '2024-01-15T12:00:00Z',
          scheduledAt: '2024-01-14T12:00:00Z',
          scheduledFor: 'course',
          schedulingAgentId: 'test-course',
        },
      ];

      const generator = new MockGenerator([]);
      generator.getPendingReviews = vi.fn().mockResolvedValue(mockReviews);

      const pipeline = new Pipeline(generator, [], mockUser, mockCourse);
      const result = await pipeline.getPendingReviews();

      expect(generator.getPendingReviews).toHaveBeenCalled();
      expect(result).toEqual(mockReviews);
    });
  });

  describe('over-fetching', () => {
    it('should over-fetch from generator based on filter count', async () => {
      const manyCards = Array.from({ length: 20 }, (_, i) =>
        createCard(`card-${i}`, 0.5 + Math.random() * 0.5)
      );

      const generator = new MockGenerator(manyCards);
      const getWeightedCardsSpy = vi.spyOn(generator, 'getWeightedCards');

      const filters = [
        createMultiplierFilter('F1', 0.9),
        createMultiplierFilter('F2', 0.9),
        createMultiplierFilter('F3', 0.9),
      ];

      const pipeline = new Pipeline(generator, filters, mockUser, mockCourse);
      await pipeline.getWeightedCards(5);

      // With 3 filters, multiplier is 2 + 3*0.5 = 3.5, so fetch 5 * 3.5 = 17.5 → 18
      const fetchLimit = getWeightedCardsSpy.mock.calls[0][0];
      expect(fetchLimit).toBeGreaterThan(5);
      expect(fetchLimit).toBeLessThanOrEqual(20);
    });
  });
});
