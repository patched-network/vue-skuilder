import type { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { ContentNavigator, isGenerator, isFilter, Navigators } from './index';
import type { CardFilter } from './filters/types';
import type { CardGenerator } from './generators/types';
import { Pipeline } from './Pipeline';
import { DocType } from '../types/types-legacy';
import { logger } from '../../util/logger';
import type { CourseDBInterface } from '../interfaces/courseDB';
import type { UserDBInterface } from '../interfaces/userDB';
import CompositeGenerator from './generators/CompositeGenerator';

// ============================================================================
// PIPELINE ASSEMBLER
// ============================================================================
//
// Assembles navigation strategies into a Pipeline instance.
//
// This class is DB-agnostic: it receives strategy documents and returns an
// assembled, ready-to-use Pipeline. This separation enables:
// 1. Use with different DB implementations (Couch, Static, etc.)
// 2. Future dynamic/evolutionary strategy selection
// 3. Easy unit testing without DB mocking
//
// Pipeline assembly:
// 1. Separate strategies into generators and filters by role
// 2. Instantiate generator(s) - wrap multiple in CompositeGenerator
// 3. Instantiate filters
// 4. Return Pipeline(generator, filters)
//
// ============================================================================

/**
 * Input for pipeline assembly.
 */
export interface PipelineAssemblerInput {
  /** All strategy documents to assemble into a pipeline */
  strategies: ContentNavigationStrategyData[];
  /** User database interface (required for instantiation) */
  user: UserDBInterface;
  /** Course database interface (required for instantiation) */
  course: CourseDBInterface;
}

/**
 * Result of pipeline assembly.
 */
export interface PipelineAssemblyResult {
  /** The assembled pipeline, or null if assembly failed */
  pipeline: Pipeline | null;
  /** Generator strategies found (for informational purposes) */
  generatorStrategies: ContentNavigationStrategyData[];
  /** Filter strategies found (for informational purposes) */
  filterStrategies: ContentNavigationStrategyData[];
  /** Warnings encountered during assembly (logged but non-fatal) */
  warnings: string[];
}

/**
 * Assembles navigation strategies into a Pipeline.
 *
 * Instantiates generators and filters from strategy documents and
 * composes them into a ready-to-use Pipeline instance.
 */
export class PipelineAssembler {
  /**
   * Assembles a navigation pipeline from strategy documents.
   *
   * 1. Separates into generators and filters by role
   * 2. Validates at least one generator exists (or creates default ELO)
   * 3. Instantiates generators - wraps multiple in CompositeGenerator
   * 4. Instantiates filters
   * 5. Returns Pipeline(generator, filters)
   *
   * @param input - Strategy documents plus user/course interfaces
   * @returns Assembled pipeline and any warnings
   */
  async assemble(input: PipelineAssemblerInput): Promise<PipelineAssemblyResult> {
    const { strategies, user, course } = input;
    const warnings: string[] = [];

    if (strategies.length === 0) {
      return {
        pipeline: null,
        generatorStrategies: [],
        filterStrategies: [],
        warnings,
      };
    }

    // Separate generators from filters
    const generatorStrategies: ContentNavigationStrategyData[] = [];
    const filterStrategies: ContentNavigationStrategyData[] = [];

    for (const s of strategies) {
      if (isGenerator(s.implementingClass)) {
        generatorStrategies.push(s);
      } else if (isFilter(s.implementingClass)) {
        filterStrategies.push(s);
      } else {
        // Unknown strategy type — skip with warning
        warnings.push(`Unknown strategy type '${s.implementingClass}', skipping: ${s.name}`);
      }
    }

    // If no generator but filters exist, use default ELO generator
    if (generatorStrategies.length === 0) {
      if (filterStrategies.length > 0) {
        logger.debug(
          '[PipelineAssembler] No generator found, using default ELO with configured filters'
        );
        generatorStrategies.push(this.makeDefaultEloStrategy(course.getCourseID()));
      } else {
        warnings.push('No generator strategy found');
        return {
          pipeline: null,
          generatorStrategies: [],
          filterStrategies: [],
          warnings,
        };
      }
    }

    // Instantiate generators
    let generator: CardGenerator;

    if (generatorStrategies.length === 1) {
      // Single generator
      const nav = await ContentNavigator.create(user, course, generatorStrategies[0]);
      generator = nav as unknown as CardGenerator;
      logger.debug(`[PipelineAssembler] Using single generator: ${generatorStrategies[0].name}`);
    } else {
      // Multiple generators - wrap in CompositeGenerator
      logger.debug(
        `[PipelineAssembler] Using CompositeGenerator for ${generatorStrategies.length} generators: ${generatorStrategies.map((g) => g.name).join(', ')}`
      );
      generator = await CompositeGenerator.fromStrategies(user, course, generatorStrategies);
    }

    // Instantiate filters
    const filters: CardFilter[] = [];

    // Sort filters alphabetically for deterministic ordering
    const sortedFilterStrategies = [...filterStrategies].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const filterStrategy of sortedFilterStrategies) {
      try {
        const nav = await ContentNavigator.create(user, course, filterStrategy);
        // The navigator implements CardFilter
        if ('transform' in nav && typeof nav.transform === 'function') {
          filters.push(nav as unknown as CardFilter);
          logger.debug(`[PipelineAssembler] Added filter: ${filterStrategy.name}`);
        } else {
          warnings.push(
            `Filter '${filterStrategy.name}' does not implement CardFilter.transform(), skipping`
          );
        }
      } catch (e) {
        warnings.push(`Failed to instantiate filter '${filterStrategy.name}': ${e}`);
      }
    }

    // Build pipeline
    const pipeline = new Pipeline(generator, filters, user, course);

    logger.debug(
      `[PipelineAssembler] Assembled pipeline with ${generatorStrategies.length} generator(s) and ${filters.length} filter(s)`
    );

    return {
      pipeline,
      generatorStrategies,
      filterStrategies: sortedFilterStrategies,
      warnings,
    };
  }

  /**
   * Creates a default ELO generator strategy.
   * Used when filters are configured but no generator is specified.
   */
  private makeDefaultEloStrategy(courseId: string): ContentNavigationStrategyData {
    return {
      _id: 'NAVIGATION_STRATEGY-ELO-default',
      course: courseId,
      docType: DocType.NAVIGATION_STRATEGY,
      name: 'ELO (default)',
      description: 'Default ELO-based generator',
      implementingClass: Navigators.ELO,
      serializedData: '',
    };
  }
}
