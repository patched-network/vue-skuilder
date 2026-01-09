/**
 * MCP Strategy Creation Integration Tests
 *
 * Tests for creating navigation strategies via the MCP create_strategy tool
 * and verifying they are accessible via the Pipeline.
 *
 * These tests verify the end-to-end flow:
 * 1. Create strategy via MCP tool
 * 2. Verify strategy is stored in course database
 * 3. Verify strategy can be retrieved via MCP resources
 * 4. Verify Pipeline can assemble and use the strategy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  TestEnvironment,
} from '../../src/harness/data-layer-factory';
import { seedRandom } from '../../src/harness/determinism';
import {
  CourseBuilder,
  ELO_GENERATOR,
  HIERARCHY_THREE_LEVELS,
  createHierarchyFilter,
} from '../../src/fixtures';

/**
 * Note: Full MCP integration tests require a running MCP server.
 * These tests document the expected behavior and test the underlying
 * database operations that the MCP tools would perform.
 *
 * For live MCP testing, use:
 *   yarn workspace @vue-skuilder/mcp dev
 */

describe('MCP create_strategy integration', () => {
  let env: TestEnvironment;
  let restoreRandom: (() => void) | null = null;

  beforeEach(async () => {
    env = await createTestEnvironment({
      courseId: 'mcp-strategy-test',
      userId: 'mcp-test-user',
      userElo: 1200,
    });

    restoreRandom = seedRandom(98765);
  });

  afterEach(async () => {
    if (restoreRandom) {
      restoreRandom();
      restoreRandom = null;
    }
    await env.cleanup();
  });

  describe('Strategy Creation via Database', () => {
    it('creates strategy with correct document structure', async () => {
      // This simulates what the MCP create_strategy tool does
      const strategyId = await env.courseDB.addNavigationStrategy({
        name: 'test-hierarchy',
        implementingClass: 'hierarchyDefinition',
        description: 'Test hierarchy for MCP integration',
        serializedData: JSON.stringify({
          levels: ['beginner', 'intermediate', 'advanced'],
          unlockThreshold: 0.75,
        }),
      });

      expect(strategyId).toMatch(/^NAVIGATION_STRATEGY-/);

      // Verify retrieval
      const strategies = await env.courseDB.getAllNavigationStrategies();
      const created = strategies.find((s) => s._id === strategyId);

      expect(created).toBeDefined();
      expect(created!.name).toBe('test-hierarchy');
      expect(created!.implementingClass).toBe('hierarchyDefinition');
    });

    it('stores learnable weight configuration', async () => {
      // Strategy with learnable weight for evolutionary optimization
      const learnableConfig = {
        weight: 1.0,
        confidence: 0.5,
        sampleSize: 0,
      };

      const strategyId = await env.courseDB.addNavigationStrategy({
        name: 'learnable-elo',
        implementingClass: 'elo',
        description: 'ELO with learnable weight',
        serializedData: JSON.stringify({
          targetRange: 200,
          learnable: learnableConfig,
        }),
      });

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const created = strategies.find((s) => s._id === strategyId);

      expect(created).toBeDefined();

      const config = JSON.parse(created!.serializedData!);
      expect(config.learnable).toEqual(learnableConfig);
    });
  });

  describe('Strategy Retrieval for Pipeline', () => {
    it('retrieves all strategies for assembly', async () => {
      const builder = new CourseBuilder()
        .addStrategy(ELO_GENERATOR)
        .addStrategy(HIERARCHY_THREE_LEVELS);

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();

      expect(strategies).toHaveLength(2);

      const classes = strategies.map((s) => s.implementingClass);
      expect(classes).toContain('elo');
      expect(classes).toContain('hierarchyDefinition');
    });

    it('strategies have unique IDs for tracking', async () => {
      const builder = new CourseBuilder()
        .addStrategy({ name: 's1', implementingClass: 'elo' })
        .addStrategy({ name: 's2', implementingClass: 'srs' })
        .addStrategy({ name: 's3', implementingClass: 'hierarchyDefinition' });

      const { strategyIds } = await builder.build(env.courseDB);

      expect(strategyIds).toHaveLength(3);

      const uniqueIds = new Set(strategyIds);
      expect(uniqueIds.size).toBe(3);
    });

    it('filters strategies by implementing class', async () => {
      const builder = new CourseBuilder()
        .addStrategy(ELO_GENERATOR)
        .addStrategy({ name: 'srs-1', implementingClass: 'srs' })
        .addStrategy(HIERARCHY_THREE_LEVELS)
        .addStrategy({ name: 'elo-filter', implementingClass: 'eloDistanceFilter' });

      await builder.build(env.courseDB);

      const allStrategies = await env.courseDB.getAllNavigationStrategies();

      // Filter generators (elo, srs)
      const generators = allStrategies.filter((s) =>
        ['elo', 'srs', 'hardcoded'].includes(s.implementingClass)
      );
      expect(generators).toHaveLength(2);

      // Filter filters (hierarchy, eloDistance)
      const filters = allStrategies.filter((s) =>
        ['hierarchyDefinition', 'eloDistanceFilter', 'interferenceFilter'].includes(
          s.implementingClass
        )
      );
      expect(filters).toHaveLength(2);
    });
  });

  describe('Strategy Configuration Parsing', () => {
    it('parses hierarchy configuration correctly', async () => {
      const levels = ['level-1', 'level-2', 'level-3', 'level-4'];
      const threshold = 0.85;

      const hierarchyDef = createHierarchyFilter('custom-hierarchy', levels, threshold);

      const builder = new CourseBuilder().addStrategy(hierarchyDef);
      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const hierarchy = strategies[0];

      const config = JSON.parse(hierarchy.serializedData!);
      expect(config.levels).toEqual(levels);
      expect(config.unlockThreshold).toBe(threshold);
    });

    it('handles missing serializedData gracefully', async () => {
      const builder = new CourseBuilder().addStrategy({
        name: 'no-config',
        implementingClass: 'elo',
        description: 'ELO with default config',
        // No serializedData
      });

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const strategy = strategies[0];

      expect(strategy.serializedData).toBeUndefined();
    });
  });

  describe('MCP Resource Simulation', () => {
    /**
     * These tests simulate what MCP resources would return.
     * The actual MCP server would use CourseDBInterface.getAllNavigationStrategies()
     * to build resource responses.
     */

    it('simulates strategies://all resource response', async () => {
      const builder = new CourseBuilder()
        .addStrategy(ELO_GENERATOR)
        .addStrategy(HIERARCHY_THREE_LEVELS);

      await builder.build(env.courseDB);

      // Simulate MCP resource handler
      const strategies = await env.courseDB.getAllNavigationStrategies();

      const resourceResponse = {
        strategies: strategies.map((s) => ({
          _id: s._id,
          name: s.name,
          implementingClass: s.implementingClass,
          description: s.description,
        })),
      };

      expect(resourceResponse.strategies).toHaveLength(2);
      expect(resourceResponse.strategies[0]).toHaveProperty('_id');
      expect(resourceResponse.strategies[0]).toHaveProperty('name');
    });

    it('simulates strategies://role/generator resource response', async () => {
      const builder = new CourseBuilder()
        .addStrategy(ELO_GENERATOR)
        .addStrategy({ name: 'srs-gen', implementingClass: 'srs' })
        .addStrategy(HIERARCHY_THREE_LEVELS);

      await builder.build(env.courseDB);

      const allStrategies = await env.courseDB.getAllNavigationStrategies();

      // Filter for generators only
      const generators = allStrategies.filter((s) =>
        ['elo', 'srs', 'hardcoded'].includes(s.implementingClass)
      );

      const resourceResponse = {
        strategies: generators.map((s) => ({
          _id: s._id,
          name: s.name,
          implementingClass: s.implementingClass,
        })),
        count: generators.length,
      };

      expect(resourceResponse.count).toBe(2);
      expect(resourceResponse.strategies.every((s) =>
        ['elo', 'srs'].includes(s.implementingClass)
      )).toBe(true);
    });

    it('simulates strategies://{strategyId} resource response', async () => {
      const builder = new CourseBuilder().addHierarchyStrategy(
        'detailed-hierarchy',
        ['a', 'b', 'c'],
        0.9
      );

      const { strategyIds } = await builder.build(env.courseDB);
      const strategyId = strategyIds[0];

      const strategies = await env.courseDB.getAllNavigationStrategies();
      const strategy = strategies.find((s) => s._id === strategyId);

      // Simulate detailed resource response
      const resourceResponse = {
        _id: strategy!._id,
        name: strategy!.name,
        implementingClass: strategy!.implementingClass,
        description: strategy!.description,
        config: JSON.parse(strategy!.serializedData!),
      };

      expect(resourceResponse._id).toBe(strategyId);
      expect(resourceResponse.config.levels).toEqual(['a', 'b', 'c']);
      expect(resourceResponse.config.unlockThreshold).toBe(0.9);
    });
  });

  describe('Pipeline Assembly Preparation', () => {
    it('provides strategies in correct format for PipelineAssembler', async () => {
      const builder = new CourseBuilder()
        .addFillInCard('Q1', 'A1', ['level-1'])
        .addFillInCard('Q2', 'A2', ['level-2'])
        .addStrategy(ELO_GENERATOR)
        .addHierarchyStrategy('progression', ['level-1', 'level-2'], 0.8);

      await builder.build(env.courseDB);

      const strategies = await env.courseDB.getAllNavigationStrategies();

      // Verify each strategy has required fields for PipelineAssembler
      for (const strategy of strategies) {
        expect(strategy).toHaveProperty('_id');
        expect(strategy).toHaveProperty('name');
        expect(strategy).toHaveProperty('implementingClass');
        // description is optional but useful
        // serializedData is optional
      }

      // Verify we have both generator and filter
      const hasGenerator = strategies.some((s) => s.implementingClass === 'elo');
      const hasFilter = strategies.some((s) => s.implementingClass === 'hierarchyDefinition');

      expect(hasGenerator).toBe(true);
      expect(hasFilter).toBe(true);
    });

    it('cards are available alongside strategies', async () => {
      const builder = new CourseBuilder()
        .addFillInCard('Easy Q', 'A', ['easy'], 800)
        .addFillInCard('Hard Q', 'A', ['hard'], 1600)
        .addStrategy(ELO_GENERATOR);

      const { cardIds, strategyIds } = await builder.build(env.courseDB);

      // Both cards and strategies should be accessible
      const cards = await env.courseDB.getAllCards();
      const strategies = await env.courseDB.getAllNavigationStrategies();

      expect(cards).toHaveLength(2);
      expect(strategies).toHaveLength(1);

      expect(cardIds).toHaveLength(2);
      expect(strategyIds).toHaveLength(1);
    });
  });

  describe('Strategy ID Format', () => {
    it('uses NAVIGATION_STRATEGY prefix', async () => {
      const strategyId = await env.courseDB.addNavigationStrategy({
        name: 'test',
        implementingClass: 'elo',
      });

      expect(strategyId.startsWith('NAVIGATION_STRATEGY-')).toBe(true);
    });

    it('generates unique IDs for concurrent creations', async () => {
      const ids = await Promise.all([
        env.courseDB.addNavigationStrategy({ name: 's1', implementingClass: 'elo' }),
        env.courseDB.addNavigationStrategy({ name: 's2', implementingClass: 'srs' }),
        env.courseDB.addNavigationStrategy({ name: 's3', implementingClass: 'elo' }),
      ]);

      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });
});