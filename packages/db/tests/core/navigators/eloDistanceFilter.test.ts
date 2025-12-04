import { describe, it, expect, vi } from 'vitest';
import {
  createEloDistanceFilter,
  DEFAULT_HALF_LIFE,
  DEFAULT_MIN_MULTIPLIER,
  DEFAULT_MAX_MULTIPLIER,
} from '../../../src/core/navigators/filters/eloDistance';
import { WeightedCard } from '../../../src/core/navigators/index';
import { FilterContext } from '../../../src/core/navigators/filters/types';
import { CourseDBInterface } from '../../../src/core/interfaces/courseDB';
import { UserDBInterface } from '../../../src/core/interfaces/userDB';

/**
 * Helper to create a weighted card for testing
 */
function createCard(id: string, score: number): WeightedCard {
  return {
    cardId: id,
    courseId: 'test-course',
    score,
    provenance: [
      {
        strategy: 'test',
        strategyName: 'Test',
        strategyId: 'TEST',
        action: 'generated',
        score,
        reason: 'Test card',
      },
    ],
  };
}

/**
 * Create mock context with specified user ELO and card ELO responses
 */
function createMockContext(userElo: number, cardEloMap: Record<string, number>): FilterContext {
  const mockCourse = {
    getCourseID: vi.fn().mockReturnValue('test-course'),
    getCardEloData: vi.fn().mockImplementation((cardIds: string[]) => {
      return Promise.resolve(
        cardIds.map((id) => ({
          global: { score: cardEloMap[id] ?? 1000, count: 10 },
          tags: {},
        }))
      );
    }),
  } as unknown as CourseDBInterface;

  const mockUser = {} as unknown as UserDBInterface;

  return {
    user: mockUser,
    course: mockCourse,
    userElo,
  };
}

describe('ELO Distance Filter', () => {
  describe('smooth curve behavior', () => {
    it('should return ~1.0 multiplier for exact ELO match', async () => {
      const filter = createEloDistanceFilter();
      const cards = [createCard('card-1', 1.0)];
      const context = createMockContext(1000, { 'card-1': 1000 });

      const result = await filter.transform(cards, context);

      expect(result[0].score).toBeCloseTo(1.0, 2);
    });

    it('should return ~0.6 multiplier at halfLife distance (200 ELO)', async () => {
      const filter = createEloDistanceFilter();
      const cards = [createCard('card-1', 1.0)];
      const context = createMockContext(1000, { 'card-1': 1200 }); // 200 distance

      const result = await filter.transform(cards, context);

      // At halfLife: minMultiplier + (maxMultiplier - minMultiplier) * exp(-1)
      // = 0.3 + 0.7 * 0.368 ≈ 0.56
      expect(result[0].score).toBeCloseTo(0.56, 1);
    });

    it('should approach minMultiplier for very large distances', async () => {
      const filter = createEloDistanceFilter();
      const cards = [createCard('card-1', 1.0)];
      const context = createMockContext(1000, { 'card-1': 2000 }); // 1000 distance (5x halfLife)

      const result = await filter.transform(cards, context);

      // Should be very close to minMultiplier (0.3)
      expect(result[0].score).toBeCloseTo(0.3, 1);
    });

    it('should be symmetric - same penalty above and below user ELO', async () => {
      const filter = createEloDistanceFilter();
      const cards = [createCard('above', 1.0), createCard('below', 1.0)];
      const context = createMockContext(1000, {
        above: 1150, // 150 above
        below: 850, // 150 below
      });

      const result = await filter.transform(cards, context);

      expect(result[0].score).toBeCloseTo(result[1].score, 4);
    });

    it('should produce monotonically decreasing scores with increasing distance', async () => {
      const filter = createEloDistanceFilter();
      const cards = [
        createCard('d0', 1.0),
        createCard('d100', 1.0),
        createCard('d200', 1.0),
        createCard('d300', 1.0),
        createCard('d400', 1.0),
      ];
      const context = createMockContext(1000, {
        d0: 1000,
        d100: 1100,
        d200: 1200,
        d300: 1300,
        d400: 1400,
      });

      const result = await filter.transform(cards, context);

      // Each should be less than the previous (smooth decay)
      for (let i = 1; i < result.length; i++) {
        expect(result[i].score).toBeLessThan(result[i - 1].score);
      }
    });

    it('should have no discontinuities - adjacent distances should have similar scores', async () => {
      const filter = createEloDistanceFilter();
      const cards = [createCard('d99', 1.0), createCard('d100', 1.0), createCard('d101', 1.0)];
      const context = createMockContext(1000, {
        d99: 1099,
        d100: 1100,
        d101: 1101,
      });

      const result = await filter.transform(cards, context);

      // Adjacent scores should differ by less than 1%
      const diff1 = Math.abs(result[0].score - result[1].score);
      const diff2 = Math.abs(result[1].score - result[2].score);

      expect(diff1).toBeLessThan(0.01);
      expect(diff2).toBeLessThan(0.01);
    });
  });

  describe('provenance tracking', () => {
    it('should append provenance entry with ELO details', async () => {
      const filter = createEloDistanceFilter();
      const cards = [createCard('card-1', 0.8)];
      const context = createMockContext(1000, { 'card-1': 1200 });

      const result = await filter.transform(cards, context);

      expect(result[0].provenance).toHaveLength(2);
      const entry = result[0].provenance[1];
      expect(entry.strategy).toBe('eloDistance');
      expect(entry.action).toBe('penalized');
      expect(entry.reason).toContain('200');
    });
  });

  describe('custom configuration', () => {
    it('should use custom halfLife when provided', async () => {
      // With halfLife=100, distance 100 should give ~0.56 multiplier
      const filter = createEloDistanceFilter({ halfLife: 100 });
      const cards = [createCard('card-1', 1.0)];
      const context = createMockContext(1000, { 'card-1': 1100 }); // 100 distance

      const result = await filter.transform(cards, context);

      expect(result[0].score).toBeCloseTo(0.56, 1);
    });

    it('should use custom min/max multipliers when provided', async () => {
      const filter = createEloDistanceFilter({
        minMultiplier: 0.5,
        maxMultiplier: 0.9,
      });
      const cards = [createCard('exact', 1.0), createCard('far', 1.0)];
      const context = createMockContext(1000, {
        exact: 1000, // 0 distance
        far: 2000, // very far
      });

      const result = await filter.transform(cards, context);

      expect(result[0].score).toBeCloseTo(0.9, 2); // maxMultiplier
      expect(result[1].score).toBeCloseTo(0.5, 1); // approaches minMultiplier
    });
  });
});
