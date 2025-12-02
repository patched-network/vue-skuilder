import { describe, it, expect } from 'vitest';
import {
  PipelineAssembler,
  PipelineAssemblerInput,
} from '../../../src/core/navigators/PipelineAssembler';
import { ContentNavigationStrategyData } from '../../../src/core/types/contentNavigationStrategy';
import { DocType } from '../../../src/core';

describe('PipelineAssembler', () => {
  const assembler = new PipelineAssembler();

  function createStrategy(
    name: string,
    implementingClass: string,
    serializedData = '{}'
  ): ContentNavigationStrategyData {
    return {
      _id: `NAVIGATION_STRATEGY-${name}`,
      docType: DocType.NAVIGATION_STRATEGY,
      name,
      description: `Test strategy: ${name}`,
      implementingClass,
      serializedData,
    };
  }

  describe('empty input', () => {
    it('returns null pipeline when no strategy documents exist', () => {
      const input: PipelineAssemblerInput = { strategies: [] };
      const result = assembler.assemble(input);

      expect(result.pipeline).toBeNull();
      expect(result.generators).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('generator-only scenarios', () => {
    it('returns generator directly when no filters exist', () => {
      const elo = createStrategy('elo-strategy', 'elo');
      const input: PipelineAssemblerInput = { strategies: [elo] };
      const result = assembler.assemble(input);

      expect(result.pipeline).toEqual(elo);
      expect(result.generators).toEqual([elo]);
      expect(result.warnings).toEqual([]);
    });

    it('warns when multiple generators exist', () => {
      const elo1 = createStrategy('elo-1', 'elo');
      const elo2 = createStrategy('elo-2', 'elo');
      const input: PipelineAssemblerInput = { strategies: [elo1, elo2] };
      const result = assembler.assemble(input);

      // Should use first generator
      expect(result.pipeline).toEqual(elo1);
      expect(result.generators).toEqual([elo1, elo2]);
      // Multiple generators are logged at debug level, not warned
      expect(result.warnings).toEqual([]);
    });

    it('uses default ELO when filters exist but no generator', () => {
      const hierarchy = createStrategy('hierarchy', 'hierarchyDefinition');
      const input: PipelineAssemblerInput = { strategies: [hierarchy] };
      const result = assembler.assemble(input);

      // Should create a default ELO generator and wrap it with the filter
      expect(result.pipeline).toBeDefined();
      expect(result.pipeline!.implementingClass).toBe('hierarchyDefinition');
      expect(result.generators).toHaveLength(1);
      expect(result.generators[0].implementingClass).toBe('elo');
      expect(result.generators[0].name).toBe('ELO (default)');
      expect(result.warnings).toEqual([]);

      // Check delegate chain points to default ELO
      const config = JSON.parse(result.pipeline!.serializedData);
      expect(config.delegateStrategy).toBe('elo');
    });
  });

  describe('filter chaining', () => {
    it('chains single filter around generator', () => {
      const elo = createStrategy('elo', 'elo');
      const hierarchy = createStrategy('hierarchy', 'hierarchyDefinition', '{"prerequisites": {}}');
      const input: PipelineAssemblerInput = { strategies: [elo, hierarchy] };
      const result = assembler.assemble(input);

      expect(result.pipeline).toBeDefined();
      expect(result.pipeline!.implementingClass).toBe('hierarchyDefinition');
      expect(result.generators).toEqual([elo]);

      // Check delegate chain
      const config = JSON.parse(result.pipeline!.serializedData);
      expect(config.delegateStrategy).toBe('elo');
      expect(config.prerequisites).toEqual({});
    });

    it('chains multiple filters alphabetically around generator', () => {
      const elo = createStrategy('elo', 'elo');
      const relativePriority = createStrategy(
        'relative-priority',
        'relativePriority',
        '{"tagPriorities": {}}'
      );
      const hierarchy = createStrategy('hierarchy', 'hierarchyDefinition', '{"prerequisites": {}}');
      const interference = createStrategy(
        'interference',
        'interferenceMitigator',
        '{"interferenceSets": []}'
      );

      const input: PipelineAssemblerInput = {
        strategies: [elo, relativePriority, hierarchy, interference],
      };
      const result = assembler.assemble(input);

      expect(result.pipeline).toBeDefined();
      expect(result.generators).toEqual([elo]);

      // Alphabetical order: hierarchy, interference, relative-priority
      // Chain: relativePriority(delegate=interference(delegate=hierarchy(delegate=elo)))
      expect(result.pipeline!.implementingClass).toBe('relativePriority');

      const outerConfig = JSON.parse(result.pipeline!.serializedData);
      expect(outerConfig.delegateStrategy).toBe('interferenceMitigator');
      expect(outerConfig.tagPriorities).toEqual({});
    });

    it('preserves filter-specific config while injecting delegateStrategy', () => {
      const elo = createStrategy('elo', 'elo');
      const hierarchy = createStrategy(
        'hierarchy',
        'hierarchyDefinition',
        JSON.stringify({
          prerequisites: {
            'tag-b': [{ tag: 'tag-a' }],
          },
        })
      );

      const input: PipelineAssemblerInput = { strategies: [elo, hierarchy] };
      const result = assembler.assemble(input);

      const config = JSON.parse(result.pipeline!.serializedData);
      expect(config.delegateStrategy).toBe('elo');
      expect(config.prerequisites).toEqual({
        'tag-b': [{ tag: 'tag-a' }],
      });
    });
  });

  describe('error handling', () => {
    it('skips unknown strategy types with warning', () => {
      const elo = createStrategy('elo', 'elo');
      const unknown = createStrategy('unknown', 'unknownStrategyType');
      const hierarchy = createStrategy('hierarchy', 'hierarchyDefinition');

      const input: PipelineAssemblerInput = { strategies: [elo, unknown, hierarchy] };
      const result = assembler.assemble(input);

      expect(result.pipeline).toBeDefined();
      expect(result.generators).toEqual([elo]);
      expect(result.warnings).toContain(
        "Unknown strategy type 'unknownStrategyType', skipping: unknown"
      );
    });

    it('warns on malformed serializedData but continues', () => {
      const elo = createStrategy('elo', 'elo');
      const malformed = createStrategy('hierarchy', 'hierarchyDefinition', 'not valid JSON {]');

      const input: PipelineAssemblerInput = { strategies: [elo, malformed] };
      const result = assembler.assemble(input);

      expect(result.pipeline).toBeDefined();
      expect(result.warnings).toContain('Failed to parse config for hierarchy, using empty config');

      // Should still build chain with empty config
      const config = JSON.parse(result.pipeline!.serializedData);
      expect(config.delegateStrategy).toBe('elo');
    });

    it('handles missing serializedData gracefully', () => {
      const elo = createStrategy('elo', 'elo');
      const hierarchy = createStrategy('hierarchy', 'hierarchyDefinition', '');

      const input: PipelineAssemblerInput = { strategies: [elo, hierarchy] };
      const result = assembler.assemble(input);

      expect(result.pipeline).toBeDefined();
      const config = JSON.parse(result.pipeline!.serializedData);
      expect(config.delegateStrategy).toBe('elo');
    });
  });

  describe('complex scenarios', () => {
    it('handles multiple generators and multiple filters', () => {
      const elo = createStrategy('elo', 'elo');
      const hardcoded = createStrategy('hardcoded', 'hardcodedOrder');
      const hierarchy = createStrategy('hierarchy', 'hierarchyDefinition');
      const relativePriority = createStrategy('priority', 'relativePriority');

      const input: PipelineAssemblerInput = {
        strategies: [elo, hardcoded, hierarchy, relativePriority],
      };
      const result = assembler.assemble(input);

      // Should return both generators
      expect(result.generators).toEqual([elo, hardcoded]);

      // Pipeline uses first generator
      expect(result.pipeline).toBeDefined();

      // Filters chained alphabetically: hierarchy, priority
      // Chain: priority(delegate=hierarchy(delegate=elo))
      expect(result.pipeline!.implementingClass).toBe('relativePriority');
      const outerConfig = JSON.parse(result.pipeline!.serializedData);
      expect(outerConfig.delegateStrategy).toBe('hierarchyDefinition');
    });

    it('maintains deterministic ordering regardless of input order', () => {
      const elo = createStrategy('elo', 'elo');
      const filterA = createStrategy('a-filter', 'hierarchyDefinition');
      const filterB = createStrategy('b-filter', 'relativePriority');
      const filterC = createStrategy('c-filter', 'interferenceMitigator');

      // Try different input orders
      const input1: PipelineAssemblerInput = {
        strategies: [filterC, elo, filterA, filterB],
      };
      const input2: PipelineAssemblerInput = {
        strategies: [filterB, filterA, filterC, elo],
      };

      const result1 = assembler.assemble(input1);
      const result2 = assembler.assemble(input2);

      // Both should produce same outermost filter (c-filter comes last alphabetically)
      expect(result1.pipeline!.implementingClass).toBe(result2.pipeline!.implementingClass);
      expect(result1.pipeline!.implementingClass).toBe('interferenceMitigator');
    });
  });
});
