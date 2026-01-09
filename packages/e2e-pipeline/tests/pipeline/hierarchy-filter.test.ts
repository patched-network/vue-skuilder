/**
 * Hierarchy Filter Strategy Tests
 *
 * Tests for hierarchy-based card filtering and progression unlocking.
 * Verifies that cards are filtered to the user's current level and
 * that levels unlock based on mastery thresholds.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestEnvironment,
  TestEnvironment,
} from '../../src/harness/data-layer-factory';
import { seedRandom } from '../../src/harness/determinism';
import {
  CourseBuilder,
  hierarchyCards,
  ELO_GENERATOR,
} from '../../src/fixtures';

describe('Hierarchy Filter Strategy', () => {
  let env: TestEnvironment;
  let restoreRandom: (() => void) | null = null;

  beforeEach(async () => {
    env = await createTestEnvironment({
      courseId: 'hierarchy-test-course',
      userId: 'hierarchy-test-user',
      userElo: 1200,
    });

    // Seed randomness for deterministic tests
    restoreRandom = seedRandom(42);
  });

  afterEach(async () => {
    if (restoreRandom) {
      restoreRandom();
      restoreRandom = null;
    }
    await env.cleanup();
  });

  describe('Hierarchy Strategy Configuration', () => {
    it('stores hierarchy levels in serializedData', async () => {
      const levels = ['beginner', 'intermediate', 'advanced'];
      const threshold = 0.75;

      const builder = new CourseBuilder().addHierarchyStrategy(
        'test-hierarchy',
        levels,
        threshold
      );

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const hierarchy = strategies.find(
        (s) => s.implementingClass === 'hierarchyDefinition'
      );

      expect(hierarchy).toBeDefined();
      expect(hierarchy!.name).toBe('test-hierarchy');

      const config = JSON.parse(hierarchy!.serializedData!);
      expect(config.levels).toEqual(levels);
      expect(config.unlockThreshold).toBe(threshold);
    });

    it('uses default threshold of 0.8 when not specified', async () => {
      const builder = new CourseBuilder().addHierarchyStrategy(
        'default-threshold',
        ['level-1', 'level-2']
      );

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const hierarchy = strategies[0];

      const config = JSON.parse(hierarchy.serializedData!);
      expect(config.unlockThreshold).toBe(0.8);
    });
  });

  describe('Card-Level Association', () => {
    it('creates cards with correct level tags', async () => {
      const levels = ['beginner', 'intermediate', 'advanced'];
      const cards = hierarchyCards(levels, 2);

      expect(cards).toHaveLength(6); // 2 cards per level

      // Check beginner cards
      const beginnerCards = cards.filter((c) => c.tags.includes('beginner'));
      expect(beginnerCards).toHaveLength(2);

      // Check intermediate cards
      const intermediateCards = cards.filter((c) =>
        c.tags.includes('intermediate')
      );
      expect(intermediateCards).toHaveLength(2);

      // Check advanced cards
      const advancedCards = cards.filter((c) => c.tags.includes('advanced'));
      expect(advancedCards).toHaveLength(2);
    });

    it('assigns graduated ELO values to hierarchy cards', async () => {
      const levels = ['beginner', 'intermediate', 'advanced'];
      const cards = hierarchyCards(levels, 2);

      // Beginner cards should have lower ELO
      const beginnerCards = cards.filter((c) => c.tags.includes('beginner'));
      const beginnerElos = beginnerCards.map((c) => c.elo!);
      expect(Math.max(...beginnerElos)).toBeLessThan(1000);

      // Advanced cards should have higher ELO
      const advancedCards = cards.filter((c) => c.tags.includes('advanced'));
      const advancedElos = advancedCards.map((c) => c.elo!);
      expect(Math.min(...advancedElos)).toBeGreaterThan(1100);
    });
  });

  describe('Course with Hierarchy', () => {
    it('builds complete hierarchical course', async () => {
      const levels = ['level-1', 'level-2', 'level-3'];
      const builder = new CourseBuilder()
        .addFillInCard('L1 Q1', 'A1', ['level-1'], 800)
        .addFillInCard('L1 Q2', 'A2', ['level-1'], 850)
        .addFillInCard('L2 Q1', 'A1', ['level-2'], 1100)
        .addFillInCard('L2 Q2', 'A2', ['level-2'], 1150)
        .addFillInCard('L3 Q1', 'A1', ['level-3'], 1400)
        .addFillInCard('L3 Q2', 'A2', ['level-3'], 1450)
        .addHierarchyStrategy('progression', levels, 0.8)
        .addStrategy(ELO_GENERATOR);

      const result = await builder.build(env.courseDB);

      expect(result.cardIds).toHaveLength(6);
      expect(result.strategyIds).toHaveLength(2);

      // Verify tag distribution
      expect(result.cardIdsByTag.get('level-1')).toHaveLength(2);
      expect(result.cardIdsByTag.get('level-2')).toHaveLength(2);
      expect(result.cardIdsByTag.get('level-3')).toHaveLength(2);
    });

    it('retrieves strategy configuration after build', async () => {
      const levels = ['basics', 'intermediate', 'expert'];

      const builder = new CourseBuilder().addHierarchyStrategy(
        'my-hierarchy',
        levels,
        0.85
      );

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      expect(strategies).toHaveLength(1);

      const hierarchy = strategies[0];
      expect(hierarchy.implementingClass).toBe('hierarchyDefinition');

      const config = JSON.parse(hierarchy.serializedData!);
      expect(config.levels).toEqual(levels);
      expect(config.unlockThreshold).toBe(0.85);
    });
  });

  describe('Five-Level Progression', () => {
    it('creates complex progression with five levels', async () => {
      const levels = ['novice', 'beginner', 'intermediate', 'advanced', 'expert'];

      const builder = new CourseBuilder()
        .addHierarchyStrategy('full-progression', levels, 0.75);

      // Add cards for each level
      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        const baseElo = 600 + i * 200;

        builder
          .addFillInCard(`${level} Q1`, 'A1', [level], baseElo)
          .addFillInCard(`${level} Q2`, 'A2', [level], baseElo + 50)
          .addFillInCard(`${level} Q3`, 'A3', [level], baseElo + 100);
      }

      const result = await builder.build(env.courseDB);

      expect(result.cardIds).toHaveLength(15); // 3 cards × 5 levels
      expect(result.strategyIds).toHaveLength(1);

      // Each level should have 3 cards
      for (const level of levels) {
        expect(result.cardIdsByTag.get(level)).toHaveLength(3);
      }
    });
  });

  describe('Mixed Tag Scenarios', () => {
    it('handles cards with multiple tags including hierarchy level', async () => {
      const builder = new CourseBuilder()
        .addFillInCard('Math L1', 'Answer', ['level-1', 'math', 'basics'], 800)
        .addFillInCard('Science L1', 'Answer', ['level-1', 'science', 'basics'], 850)
        .addFillInCard('Math L2', 'Answer', ['level-2', 'math', 'advanced'], 1200)
        .addHierarchyStrategy('progression', ['level-1', 'level-2'], 0.8);

      const result = await builder.build(env.courseDB);

      expect(result.cardIds).toHaveLength(3);

      // Check multi-tag tracking
      expect(result.cardIdsByTag.get('level-1')).toHaveLength(2);
      expect(result.cardIdsByTag.get('math')).toHaveLength(2);
      expect(result.cardIdsByTag.get('science')).toHaveLength(1);
    });

    it('cards without hierarchy tags are not filtered out', async () => {
      const builder = new CourseBuilder()
        .addFillInCard('Misc Q1', 'A1', ['misc', 'general'], 1000)
        .addFillInCard('Level Q1', 'A1', ['level-1', 'math'], 800)
        .addHierarchyStrategy('progression', ['level-1', 'level-2'], 0.8);

      const result = await builder.build(env.courseDB);

      expect(result.cardIds).toHaveLength(2);

      // 'misc' card should be tracked
      expect(result.cardIdsByTag.get('misc')).toHaveLength(1);
      expect(result.cardIdsByTag.get('general')).toHaveLength(1);
    });
  });

  describe('Strategy Retrieval', () => {
    it('retrieves all strategies for pipeline assembly', async () => {
      const builder = new CourseBuilder()
        .addStrategy(ELO_GENERATOR)
        .addHierarchyStrategy('progression', ['l1', 'l2', 'l3'], 0.8);

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();

      expect(strategies).toHaveLength(2);

      const implementingClasses = strategies.map((s) => s.implementingClass);
      expect(implementingClasses).toContain('elo');
      expect(implementingClasses).toContain('hierarchyDefinition');
    });

    it('strategies have unique IDs', async () => {
      const builder = new CourseBuilder()
        .addHierarchyStrategy('h1', ['a', 'b'])
        .addHierarchyStrategy('h2', ['x', 'y']);

      const result = await builder.build(env.courseDB);

      expect(result.strategyIds).toHaveLength(2);
      expect(result.strategyIds[0]).not.toBe(result.strategyIds[1]);
    });
  });
});