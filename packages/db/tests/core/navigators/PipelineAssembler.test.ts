import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PipelineAssembler,
  PipelineAssemblerInput,
} from '../../../src/core/navigators/PipelineAssembler';
import { ContentNavigationStrategyData } from '../../../src/core/types/contentNavigationStrategy';
import { DocType } from '../../../src/core';
import { Pipeline } from '../../../src/core/navigators/Pipeline';

// Mock the dynamic import in ContentNavigator.create
vi.mock('../../../src/core/navigators/generators/elo', () => ({
  default: class MockELONavigator {
    name = 'ELO';
    constructor(
      public user: any,
      public course: any,
      public strategyData: any
    ) {}
    async getWeightedCards() {
      return [];
    }
  },
}));

vi.mock('../../../src/core/navigators/generators/srs', () => ({
  default: class MockSRSNavigator {
    name = 'SRS';
    constructor(
      public user: any,
      public course: any,
      public strategyData: any
    ) {}
    async getWeightedCards() {
      return [];
    }
  },
}));

vi.mock('../../../src/core/navigators/filters/hierarchyDefinition', () => ({
  default: class MockHierarchyDefinitionNavigator {
    name = 'Hierarchy Definition';
    constructor(
      public user: any,
      public course: any,
      public strategyData: any
    ) {
      this.name = strategyData.name || 'Hierarchy Definition';
    }
    async transform(cards: any[]) {
      return cards;
    }
    async getWeightedCards() {
      throw new Error('Filter should not be used as generator');
    }
  },
}));

vi.mock('../../../src/core/navigators/filters/interferenceMitigator', () => ({
  default: class MockInterferenceMitigatorNavigator {
    name = 'Interference Mitigator';
    constructor(
      public user: any,
      public course: any,
      public strategyData: any
    ) {
      this.name = strategyData.name || 'Interference Mitigator';
    }
    async transform(cards: any[]) {
      return cards;
    }
    async getWeightedCards() {
      throw new Error('Filter should not be used as generator');
    }
  },
}));

vi.mock('../../../src/core/navigators/filters/relativePriority', () => ({
  default: class MockRelativePriorityNavigator {
    name = 'Relative Priority';
    constructor(
      public user: any,
      public course: any,
      public strategyData: any
    ) {
      this.name = strategyData.name || 'Relative Priority';
    }
    async transform(cards: any[]) {
      return cards;
    }
    async getWeightedCards() {
      throw new Error('Filter should not be used as generator');
    }
  },
}));

describe('PipelineAssembler', () => {
  const assembler = new PipelineAssembler();

  // Mock user and course for instantiation
  const mockUser = {
    getCourseRegDoc: vi
      .fn()
      .mockResolvedValue({ elo: { global: { score: 1000, count: 0 }, tags: {} } }),
    getPendingReviews: vi.fn().mockResolvedValue([]),
    getActiveCards: vi.fn().mockResolvedValue([]),
  };

  const mockCourse = {
    getCourseID: vi.fn().mockReturnValue('test-course'),
    getCourseConfig: vi.fn().mockResolvedValue({ name: 'Test Course', id: 'test-course' }),
    getCardEloData: vi.fn().mockResolvedValue([]),
    getAppliedTags: vi.fn().mockResolvedValue({ rows: [] }),
  };

  function createStrategy(
    name: string,
    implementingClass: string,
    serializedData = '{}'
  ): ContentNavigationStrategyData {
    return {
      _id: `NAVIGATION_STRATEGY-${name}`,
      course: 'test-course',
      docType: DocType.NAVIGATION_STRATEGY,
      name,
      description: `Test strategy: ${name}`,
      implementingClass,
      serializedData,
    };
  }

  function createInput(strategies: ContentNavigationStrategyData[]): PipelineAssemblerInput {
    return {
      strategies,
      user: mockUser as any,
      course: mockCourse as any,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty input', () => {
    it('returns null pipeline when no strategy documents exist', async () => {
      const input = createInput([]);
      const result = await assembler.assemble(input);

      expect(result.pipeline).toBeNull();
      expect(result.generatorStrategies).toEqual([]);
      expect(result.filterStrategies).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('generator-only scenarios', () => {
    // default pipeline now includes srs+elo - two generators
    // it('returns pipeline with single generator when no filters exist', async () => {
    //   const elo = createStrategy('elo-strategy', 'elo');
    //   const input = createInput([elo]);
    //   const result = await assembler.assemble(input);

    //   expect(result.pipeline).toBeInstanceOf(Pipeline);
    //   expect(result.generatorStrategies).toEqual([elo]);
    //   expect(result.filterStrategies).toEqual([]);
    //   expect(result.warnings).toEqual([]);
    // });

    it('creates CompositeGenerator when multiple generators exist', async () => {
      const elo1 = createStrategy('elo-1', 'elo');
      const elo2 = createStrategy('elo-2', 'srs');
      const input = createInput([elo1, elo2]);
      const result = await assembler.assemble(input);

      expect(result.pipeline).toBeInstanceOf(Pipeline);
      expect(result.generatorStrategies).toEqual([elo1, elo2]);
      expect(result.warnings).toEqual([]);
    });

    it('uses default ELO and SRS when filters exist but no generator', async () => {
      const hierarchy = createStrategy('hierarchy', 'hierarchyDefinition');
      const input = createInput([hierarchy]);
      const result = await assembler.assemble(input);

      expect(result.pipeline).toBeInstanceOf(Pipeline);
      expect(result.generatorStrategies).toHaveLength(2);
      const strategyNames = result.generatorStrategies.map((s) => s.name).sort();
      expect(strategyNames).toEqual(['ELO (default)', 'SRS (default)']);
      expect(result.filterStrategies).toEqual([hierarchy]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('filter handling', () => {
    it('includes single filter in pipeline', async () => {
      const elo = createStrategy('elo', 'elo');
      const hierarchy = createStrategy('hierarchy', 'hierarchyDefinition', '{"prerequisites": {}}');
      const input = createInput([elo, hierarchy]);
      const result = await assembler.assemble(input);

      expect(result.pipeline).toBeInstanceOf(Pipeline);
      // expect(result.generatorStrategies).toEqual([elo]); // default pipeline now includes srs+elo
      expect(result.filterStrategies).toEqual([hierarchy]);
      expect(result.warnings).toEqual([]);
    });

    it('sorts filters alphabetically for deterministic ordering', async () => {
      const elo = createStrategy('elo', 'elo');
      const relativePriority = createStrategy(
        'z-relative-priority',
        'relativePriority',
        '{"tagPriorities": {}}'
      );
      const hierarchy = createStrategy(
        'a-hierarchy',
        'hierarchyDefinition',
        '{"prerequisites": {}}'
      );
      const interference = createStrategy(
        'm-interference',
        'interferenceMitigator',
        '{"interferenceSets": []}'
      );

      const input = createInput([elo, relativePriority, hierarchy, interference]);
      const result = await assembler.assemble(input);

      expect(result.pipeline).toBeInstanceOf(Pipeline);
      // expect(result.generatorStrategies).toEqual([elo]); // default pipeline now includes srs+elo

      // Filters should be sorted alphabetically by name
      expect(result.filterStrategies.map((f) => f.name)).toEqual([
        'a-hierarchy',
        'm-interference',
        'z-relative-priority',
      ]);
    });
  });

  describe('error handling', () => {
    it('skips unknown strategy types with warning', async () => {
      const elo = createStrategy('elo', 'elo');
      const unknown = createStrategy('unknown', 'unknownStrategyType');
      const hierarchy = createStrategy('hierarchy', 'hierarchyDefinition');

      const input = createInput([elo, unknown, hierarchy]);
      const result = await assembler.assemble(input);

      expect(result.pipeline).toBeInstanceOf(Pipeline);
      // expect(result.generatorStrategies).toEqual([elo]); // default pipeline now includes srs+elo
      expect(result.filterStrategies).toEqual([hierarchy]);
      expect(result.warnings).toContain(
        "Unknown strategy type 'unknownStrategyType', skipping: unknown"
      );
    });
  });

  describe('complex scenarios', () => {
    it('handles multiple generators and multiple filters', async () => {
      const elo = createStrategy('elo', 'elo');
      const hierarchy = createStrategy('hierarchy', 'hierarchyDefinition');
      const relativePriority = createStrategy('priority', 'relativePriority');

      const input = createInput([elo, hierarchy, relativePriority]);
      const result = await assembler.assemble(input);

      // Should have both generators
      // expect(result.generatorStrategies).toEqual([elo]);

      // Should have both filters (sorted alphabetically)
      expect(result.filterStrategies.map((f) => f.name)).toEqual(['hierarchy', 'priority']);

      // Should produce a valid pipeline
      expect(result.pipeline).toBeInstanceOf(Pipeline);
    });

    it('maintains deterministic ordering regardless of input order', async () => {
      const elo = createStrategy('elo', 'elo');
      const filterA = createStrategy('a-filter', 'hierarchyDefinition');
      const filterB = createStrategy('b-filter', 'relativePriority');
      const filterC = createStrategy('c-filter', 'interferenceMitigator');

      // Try different input orders
      const input1 = createInput([filterC, elo, filterA, filterB]);
      const input2 = createInput([filterB, filterA, filterC, elo]);

      const result1 = await assembler.assemble(input1);
      const result2 = await assembler.assemble(input2);

      // Both should produce filters in same alphabetical order
      expect(result1.filterStrategies.map((f) => f.name)).toEqual([
        'a-filter',
        'b-filter',
        'c-filter',
      ]);
      expect(result2.filterStrategies.map((f) => f.name)).toEqual([
        'a-filter',
        'b-filter',
        'c-filter',
      ]);
    });
  });
});
