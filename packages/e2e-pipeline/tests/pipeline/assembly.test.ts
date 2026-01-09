/**
 * Pipeline Assembly Tests
 *
 * Tests for PipelineAssembler - the component that constructs
 * navigation pipelines from strategy documents.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  TestEnvironment,
} from '../../src/harness/data-layer-factory';
import {
  CourseBuilder,
  ELO_GENERATOR,
  SRS_GENERATOR,
  HIERARCHY_THREE_LEVELS,
  ELO_DISTANCE_FILTER,
  minimalStrategies,
} from '../../src/fixtures';

describe('PipelineAssembler', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      courseId: 'assembly-test-course',
      userId: 'assembly-test-user',
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Strategy Classification', () => {
    it('identifies generator strategies by implementingClass', async () => {
      const builder = new CourseBuilder()
        .addStrategy(ELO_GENERATOR)
        .addStrategy(SRS_GENERATOR);

      const { strategyIds } = await builder.build(env.courseDB);

      expect(strategyIds).toHaveLength(2);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      expect(strategies).toHaveLength(2);

      // Both should be recognized as generators
      const generatorClasses = strategies.map((s) => s.implementingClass);
      expect(generatorClasses).toContain('elo');
      expect(generatorClasses).toContain('srs');
    });

    it('identifies filter strategies by implementingClass', async () => {
      const builder = new CourseBuilder()
        .addStrategy(HIERARCHY_THREE_LEVELS)
        .addStrategy(ELO_DISTANCE_FILTER);

      const { strategyIds } = await builder.build(env.courseDB);

      expect(strategyIds).toHaveLength(2);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const filterClasses = strategies.map((s) => s.implementingClass);
      expect(filterClasses).toContain('hierarchyDefinition');
      expect(filterClasses).toContain('eloDistanceFilter');
    });

    it('separates generators and filters correctly', async () => {
      const builder = new CourseBuilder()
        .addStrategy(ELO_GENERATOR)
        .addStrategy(SRS_GENERATOR)
        .addStrategy(HIERARCHY_THREE_LEVELS)
        .addStrategy(ELO_DISTANCE_FILTER);

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      expect(strategies).toHaveLength(4);

      // Verify we can identify each type
      const generators = strategies.filter((s) =>
        ['elo', 'srs', 'hardcoded'].includes(s.implementingClass)
      );
      const filters = strategies.filter((s) =>
        ['hierarchyDefinition', 'eloDistanceFilter', 'interferenceFilter', 'relativePriority'].includes(
          s.implementingClass
        )
      );

      expect(generators).toHaveLength(2);
      expect(filters).toHaveLength(2);
    });
  });

  describe('Strategy Storage', () => {
    it('stores strategy with correct document structure', async () => {
      const builder = new CourseBuilder().addStrategy({
        name: 'test-strategy',
        implementingClass: 'elo',
        description: 'Test ELO strategy',
        serializedData: JSON.stringify({ targetRange: 200 }),
      });

      const { strategyIds } = await builder.build(env.courseDB);
      expect(strategyIds).toHaveLength(1);

      // Verify the strategy ID format
      expect(strategyIds[0]).toMatch(/^NAVIGATION_STRATEGY-/);

      // Retrieve and verify structure
      const strategies = await env.courseDB.getAllNavigationStrategies();
      const strategy = strategies[0];

      expect(strategy).toMatchObject({
        name: 'test-strategy',
        implementingClass: 'elo',
        description: 'Test ELO strategy',
      });

      // Verify serializedData is stored correctly
      expect(strategy.serializedData).toBeDefined();
      const parsedData = JSON.parse(strategy.serializedData!);
      expect(parsedData.targetRange).toBe(200);
    });

    it('stores multiple strategies with unique IDs', async () => {
      const builder = new CourseBuilder()
        .addStrategy({ name: 'strategy-1', implementingClass: 'elo' })
        .addStrategy({ name: 'strategy-2', implementingClass: 'srs' })
        .addStrategy({ name: 'strategy-3', implementingClass: 'hierarchyDefinition' });

      const { strategyIds } = await builder.build(env.courseDB);

      expect(strategyIds).toHaveLength(3);

      // All IDs should be unique
      const uniqueIds = new Set(strategyIds);
      expect(uniqueIds.size).toBe(3);

      // All should follow the ID pattern
      for (const id of strategyIds) {
        expect(id).toMatch(/^NAVIGATION_STRATEGY-/);
      }
    });
  });

  describe('Hierarchy Strategy Config', () => {
    it('stores hierarchy levels correctly', async () => {
      const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
      const unlockThreshold = 0.75;

      const builder = new CourseBuilder().addHierarchyStrategy(
        'progression',
        levels,
        unlockThreshold
      );

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const hierarchy = strategies.find(
        (s) => s.implementingClass === 'hierarchyDefinition'
      );

      expect(hierarchy).toBeDefined();
      expect(hierarchy!.name).toBe('progression');

      const config = JSON.parse(hierarchy!.serializedData!);
      expect(config.levels).toEqual(levels);
      expect(config.unlockThreshold).toBe(unlockThreshold);
    });
  });

  describe('ELO Strategy Config', () => {
    it('stores ELO options correctly', async () => {
      const builder = new CourseBuilder().addEloStrategy('elo-match', {
        targetRange: 150,
        priorityMultiplier: 1.5,
      });

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const elo = strategies.find((s) => s.implementingClass === 'elo');

      expect(elo).toBeDefined();

      const config = JSON.parse(elo!.serializedData!);
      expect(config.targetRange).toBe(150);
      expect(config.priorityMultiplier).toBe(1.5);
    });

    it('works without options (uses defaults)', async () => {
      const builder = new CourseBuilder().addEloStrategy('elo-default');

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const elo = strategies.find((s) => s.implementingClass === 'elo');

      expect(elo).toBeDefined();
      expect(elo!.serializedData).toBeUndefined();
    });
  });

  describe('Course Builder Integration', () => {
    it('builds course with cards and strategies together', async () => {
      const builder = new CourseBuilder()
        .addFillInCard('Q1', 'A1', ['basics'])
        .addFillInCard('Q2', 'A2', ['basics'])
        .addFillInCard('Q3', 'A3', ['advanced'])
        .addStrategy(ELO_GENERATOR)
        .addHierarchyStrategy('levels', ['basics', 'advanced']);

      const result = await builder.build(env.courseDB);

      expect(result.cardIds).toHaveLength(3);
      expect(result.strategyIds).toHaveLength(2);

      // Verify cards by tag tracking
      expect(result.cardIdsByTag.get('basics')).toHaveLength(2);
      expect(result.cardIdsByTag.get('advanced')).toHaveLength(1);
    });

    it('resets builder for multiple uses', async () => {
      const builder = new CourseBuilder()
        .addFillInCard('Q1', 'A1')
        .addStrategy(ELO_GENERATOR);

      expect(builder.getCardCount()).toBe(1);
      expect(builder.getStrategyCount()).toBe(1);

      builder.reset();

      expect(builder.getCardCount()).toBe(0);
      expect(builder.getStrategyCount()).toBe(0);
    });

    it('uses minimal strategies preset', async () => {
      const strategies = minimalStrategies();

      expect(strategies).toHaveLength(1);
      expect(strategies[0].implementingClass).toBe('elo');
    });
  });
});