import { toCourseElo } from '@vue-skuilder/common';
import type { CourseDBInterface } from '../interfaces/courseDB';
import type { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator } from './index';
import type { WeightedCard } from './index';
import type { CardFilter, FilterContext } from './filters/types';
import type { CardGenerator, GeneratorContext } from './generators/types';
import { logger } from '../../util/logger';
import { createOrchestrationContext, OrchestrationContext } from '../orchestration';

// ============================================================================
// PIPELINE LOGGING HELPERS
// ============================================================================
//
// Focused logging functions that can be toggled by commenting single lines.
// Use these to inspect pipeline behavior in development/production.
//

/**
 * Log pipeline configuration on construction.
 * Shows generator and filter chain structure.
 */
function logPipelineConfig(generator: CardGenerator, filters: CardFilter[]): void {
  const filterList =
    filters.length > 0 ? '\n    - ' + filters.map((f) => f.name).join('\n    - ') : ' none';

  logger.info(
    `[Pipeline] Configuration:\n` + `  Generator: ${generator.name}\n` + `  Filters:${filterList}`
  );
}

/**
 * Log tag hydration results.
 * Shows effectiveness of batch query (how many cards/tags were hydrated).
 */
function logTagHydration(cards: WeightedCard[], tagsByCard: Map<string, string[]>): void {
  const totalTags = Array.from(tagsByCard.values()).reduce((sum, tags) => sum + tags.length, 0);
  const cardsWithTags = Array.from(tagsByCard.values()).filter((tags) => tags.length > 0).length;

  logger.debug(
    `[Pipeline] Tag hydration: ${cards.length} cards, ` +
      `${cardsWithTags} have tags (${totalTags} total tags) - single batch query`
  );
}

/**
 * Log pipeline execution summary.
 * Shows complete flow from generator through filters to final results.
 */
function logExecutionSummary(
  generatorName: string,
  generatedCount: number,
  filterCount: number,
  finalCount: number,
  topScores: number[]
): void {
  const scoreDisplay =
    topScores.length > 0 ? topScores.map((s) => s.toFixed(2)).join(', ') : 'none';

  logger.info(
    `[Pipeline] Execution: ${generatorName} produced ${generatedCount} → ` +
      `${filterCount} filters → ${finalCount} results (top scores: ${scoreDisplay})`
  );
}

/**
 * Log provenance trails for cards.
 * Shows the complete scoring history for each card through the pipeline.
 * Useful for debugging why cards scored the way they did.
 */
function logCardProvenance(cards: WeightedCard[], maxCards: number = 3): void {
  const cardsToLog = cards.slice(0, maxCards);

  logger.debug(`[Pipeline] Provenance for top ${cardsToLog.length} cards:`);

  for (const card of cardsToLog) {
    logger.debug(`[Pipeline]   ${card.cardId} (final score: ${card.score.toFixed(3)}):`);

    for (const entry of card.provenance) {
      const scoreChange = entry.score.toFixed(3);
      const action = entry.action.padEnd(9); // Align columns
      logger.debug(
        `[Pipeline]     ${action} ${scoreChange} - ${entry.strategyName}: ${entry.reason}`
      );
    }
  }
}

// ============================================================================
// PIPELINE
// ============================================================================
//
// Executes a navigation pipeline: generator → filters → sorted results.
//
// Architecture:
//   cards = generator.getWeightedCards(limit, context)
//   cards = filter1.transform(cards, context)
//   cards = filter2.transform(cards, context)
//   cards = filter3.transform(cards, context)
//   return sorted(cards).slice(0, limit)
//
// Benefits:
// - Clear separation: generators produce, filters transform
// - No nested instantiation complexity
// - Filters don't need to know about each other
// - Shared context built once, passed to all stages
//
// ============================================================================

/**
 * A navigation pipeline that runs a generator and applies filters sequentially.
 *
 * Implements StudyContentSource for backward compatibility with SessionController.
 *
 * ## Usage
 *
 * ```typescript
 * const pipeline = new Pipeline(
 *   compositeGenerator,  // or single generator
 *   [eloDistanceFilter, interferenceFilter],
 *   user,
 *   course
 * );
 *
 * const cards = await pipeline.getWeightedCards(20);
 * ```
 */
export class Pipeline extends ContentNavigator {
  private generator: CardGenerator;
  private filters: CardFilter[];

  /**
   * Create a new pipeline.
   *
   * @param generator - The generator (or CompositeGenerator) that produces candidates
   * @param filters - Filters to apply sequentially (order doesn't matter for multipliers)
   * @param user - User database interface
   * @param course - Course database interface
   */
  constructor(
    generator: CardGenerator,
    filters: CardFilter[],
    user: UserDBInterface,
    course: CourseDBInterface
  ) {
    super();
    this.generator = generator;
    this.filters = filters;
    this.user = user;
    this.course = course;

    course
      .getCourseConfig()
      .then((cfg) => {
        logger.debug(`[pipeline] Crated pipeline for ${cfg.name}`);
      })
      .catch((e) => {
        logger.error(`[pipeline] Failed to lookup courseCfg: ${e}`);
      });
    // Toggle pipeline configuration logging:
    logPipelineConfig(generator, filters);
  }

  /**
   * Get weighted cards by running generator and applying filters.
   *
   * 1. Build shared context (user ELO, etc.)
   * 2. Get candidates from generator (passing context)
   * 3. Batch hydrate tags for all candidates
   * 4. Apply each filter sequentially
   * 5. Remove zero-score cards
   * 6. Sort by score descending
   * 7. Return top N
   *
   * @param limit - Maximum number of cards to return
   * @returns Cards sorted by score descending
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Build shared context once
    const context = await this.buildContext();

    // Over-fetch from generator to account for filtering
    const overFetchMultiplier = 2 + this.filters.length * 0.5;
    const fetchLimit = Math.ceil(limit * overFetchMultiplier);

    logger.debug(
      `[Pipeline] Fetching ${fetchLimit} candidates from generator '${this.generator.name}'`
    );

    // Get candidates from generator, passing context
    let cards = await this.generator.getWeightedCards(fetchLimit, context);
    const generatedCount = cards.length;

    logger.debug(`[Pipeline] Generator returned ${generatedCount} candidates`);

    // Batch hydrate tags before filters run
    cards = await this.hydrateTags(cards);

    // Apply filters sequentially
    for (const filter of this.filters) {
      const beforeCount = cards.length;
      cards = await filter.transform(cards, context);
      logger.debug(`[Pipeline] Filter '${filter.name}': ${beforeCount} → ${cards.length} cards`);
    }

    // Remove zero-score cards (hard filtered)
    cards = cards.filter((c) => c.score > 0);

    // Sort by score descending
    cards.sort((a, b) => b.score - a.score);

    // Return top N
    const result = cards.slice(0, limit);

    // Toggle execution summary logging:
    const topScores = result.slice(0, 3).map((c) => c.score);
    logExecutionSummary(
      this.generator.name,
      generatedCount,
      this.filters.length,
      result.length,
      topScores
    );

    // Toggle provenance logging (shows scoring history for top cards):
    logCardProvenance(result, 3);

    return result;
  }

  /**
   * Batch hydrate tags for all cards.
   *
   * Fetches tags for all cards in a single database query and attaches them
   * to the WeightedCard objects. Filters can then use card.tags instead of
   * making individual getAppliedTags() calls.
   *
   * @param cards - Cards to hydrate
   * @returns Cards with tags populated
   */
  private async hydrateTags(cards: WeightedCard[]): Promise<WeightedCard[]> {
    if (cards.length === 0) {
      return cards;
    }

    const cardIds = cards.map((c) => c.cardId);
    const tagsByCard = await this.course!.getAppliedTagsBatch(cardIds);

    // Toggle tag hydration logging:
    logTagHydration(cards, tagsByCard);

    return cards.map((card) => ({
      ...card,
      tags: tagsByCard.get(card.cardId) ?? [],
    }));
  }

  /**
   * Build shared context for generator and filters.
   *
   * Called once per getWeightedCards() invocation.
   * Contains data that the generator and multiple filters might need.
   *
   * The context satisfies both GeneratorContext and FilterContext interfaces.
   */
  private async buildContext(): Promise<GeneratorContext & FilterContext> {
    let userElo = 1000; // Default ELO

    try {
      const courseReg = await this.user!.getCourseRegDoc(this.course!.getCourseID());
      const courseElo = toCourseElo(courseReg.elo);
      userElo = courseElo.global.score;
    } catch (e) {
      logger.debug(`[Pipeline] Could not get user ELO, using default: ${e}`);
    }

    // Initialize orchestration context (used for evolutionary weighting)
    const orchestration = await createOrchestrationContext(this.user!, this.course!);

    return {
      user: this.user!,
      course: this.course!,
      userElo,
      orchestration,
    };
  }

  /**
   * Get the course ID for this pipeline.
   */
  getCourseID(): string {
    return this.course!.getCourseID();
  }

  /**
   * Get orchestration context for outcome recording.
   */
  async getOrchestrationContext(): Promise<OrchestrationContext> {
    return createOrchestrationContext(this.user!, this.course!);
  }

  /**
   * Get IDs of all strategies in this pipeline.
   * Used to record which strategies contributed to an outcome.
   */
  getStrategyIds(): string[] {
    const ids: string[] = [];

    const extractId = (obj: any): string | null => {
      // Check for strategyId property (ContentNavigator, WeightedFilter)
      if (obj.strategyId) return obj.strategyId;
      return null;
    };

    // Generator(s)
    const genId = extractId(this.generator);
    if (genId) ids.push(genId);

    // Inspect CompositeGenerator children (accessing private field via cast)
    if ((this.generator as any).generators && Array.isArray((this.generator as any).generators)) {
      (this.generator as any).generators.forEach((g: any) => {
        const subId = extractId(g);
        if (subId) ids.push(subId);
      });
    }

    // Filters
    for (const filter of this.filters) {
      const fId = extractId(filter);
      if (fId) ids.push(fId);
    }

    return [...new Set(ids)];
  }
}
