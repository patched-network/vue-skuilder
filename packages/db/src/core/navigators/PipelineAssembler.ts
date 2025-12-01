import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { isGenerator, isFilter } from './index';
import { logger } from '../../util/logger';

// ============================================================================
// PIPELINE ASSEMBLER
// ============================================================================
//
// Assembles navigation strategies into a delegate chain.
//
// This class is DB-agnostic: it receives strategy documents and returns an
// assembled pipeline. This separation enables:
// 1. Use with different DB implementations (Couch, Static, etc.)
// 2. Future dynamic/evolutionary strategy selection
// 3. Easy unit testing without DB mocking
//
// Pipeline assembly rules:
// - Exactly one generator is required (ELO, SRS, HardcodedOrder)
// - Zero or more filters can wrap the generator
// - Filter order doesn't matter (all filters are score multipliers)
// - Filters are chained alphabetically for deterministic behavior
//
// ============================================================================

/**
 * Input for pipeline assembly.
 */
export interface PipelineAssemblerInput {
  /** All strategy documents to assemble into a pipeline */
  strategies: ContentNavigationStrategyData[];
}

/**
 * Result of pipeline assembly.
 */
export interface PipelineAssemblyResult {
  /** The assembled pipeline (outermost strategy), or null if assembly failed */
  pipeline: ContentNavigationStrategyData | null;
  /** Warnings encountered during assembly (logged but non-fatal) */
  warnings: string[];
}

/**
 * Assembles navigation strategies into a delegate chain.
 *
 * DB-agnostic: receives strategy documents, returns assembled pipeline.
 * Prepares for future dynamic/evolutionary selection by isolating assembly logic.
 */
export class PipelineAssembler {
  /**
   * Assembles a navigation pipeline from strategy documents.
   *
   * 1. Separates into generators and filters
   * 2. Validates exactly one generator exists
   * 3. Chains filters around generator (order doesn't matter — all are multipliers)
   * 4. Skips unknown strategy types, logs warnings
   * 5. Returns outermost strategy config
   *
   * @param input - Strategy documents to assemble
   * @returns Assembled pipeline and any warnings
   */
  assemble(input: PipelineAssemblerInput): PipelineAssemblyResult {
    const { strategies } = input;
    const warnings: string[] = [];

    if (strategies.length === 0) {
      return { pipeline: null, warnings };
    }

    // Separate generators from filters
    const generators: ContentNavigationStrategyData[] = [];
    const filters: ContentNavigationStrategyData[] = [];

    for (const s of strategies) {
      if (isGenerator(s.implementingClass)) {
        generators.push(s);
      } else if (isFilter(s.implementingClass)) {
        filters.push(s);
      } else {
        // Unknown strategy type — skip with warning
        warnings.push(`Unknown strategy type '${s.implementingClass}', skipping: ${s.name}`);
      }
    }

    // Validate exactly one generator
    if (generators.length === 0) {
      warnings.push('No generator strategy found');
      return { pipeline: null, warnings };
    }
    if (generators.length > 1) {
      warnings.push(
        `Multiple generators found (${generators.map((g) => g.name).join(', ')}), using first: ${generators[0].name}`
      );
    }

    const generator = generators[0];

    if (filters.length === 0) {
      // Just the generator, no filters
      return { pipeline: generator, warnings };
    }

    // Sort filters alphabetically for deterministic ordering
    // (Order doesn't affect results since all filters are multipliers)
    const sortedFilters = [...filters].sort((a, b) => a.name.localeCompare(b.name));

    // Build delegate chain
    const pipeline = this.buildChain(generator, sortedFilters, warnings);
    return { pipeline, warnings };
  }

  /**
   * Builds a delegate chain from a generator and filters.
   *
   * Each filter's serializedData gets delegateStrategy pointing to the previous
   * strategy in the chain. The generator is at the innermost level.
   *
   * For filters [A, B, C] and generator G:
   * Result: C(delegate=B(delegate=A(delegate=G)))
   *
   * @param generator - The base generator strategy
   * @param filters - Filters to chain (in order)
   * @param warnings - Array to append warnings to
   * @returns The outermost strategy in the chain
   */
  private buildChain(
    generator: ContentNavigationStrategyData,
    filters: ContentNavigationStrategyData[],
    warnings: string[]
  ): ContentNavigationStrategyData {
    let previousImpl = generator.implementingClass;
    let outermost: ContentNavigationStrategyData = generator;

    for (const filter of filters) {
      // Parse existing config, inject delegateStrategy
      let config: Record<string, unknown> = {};
      try {
        config = JSON.parse(filter.serializedData || '{}');
      } catch (e) {
        warnings.push(`Failed to parse config for ${filter.name}, using empty config`);
        config = {};
      }
      config.delegateStrategy = previousImpl;

      outermost = {
        ...filter,
        serializedData: JSON.stringify(config),
      };
      previousImpl = filter.implementingClass;
    }

    logger.debug(
      `[PipelineAssembler] Built chain: ${filters.map((f) => f.implementingClass).join(' → ')} → ${generator.implementingClass}`
    );

    return outermost;
  }
}
