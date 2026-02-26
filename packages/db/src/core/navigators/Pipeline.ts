import { toCourseElo } from '@vue-skuilder/common';
import type { CourseDBInterface } from '../interfaces/courseDB';
import type { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator } from './index';
import type { WeightedCard } from './index';
import type { CardFilter, FilterContext } from './filters/types';
import type { CardGenerator, GeneratorContext } from './generators/types';
import { logger } from '../../util/logger';
import { createOrchestrationContext, OrchestrationContext } from '../orchestration';
import { captureRun, buildRunReport, type GeneratorSummary, type FilterImpact } from './PipelineDebugger';

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
  topScores: number[],
  filterImpacts: Array<{ name: string; boosted: number; penalized: number; passed: number }>
): void {
  const scoreDisplay =
    topScores.length > 0 ? topScores.map((s) => s.toFixed(2)).join(', ') : 'none';

  let filterSummary = '';
  if (filterImpacts.length > 0) {
    const impacts = filterImpacts.map((f) => {
      const parts: string[] = [];
      if (f.boosted > 0) parts.push(`+${f.boosted}`);
      if (f.penalized > 0) parts.push(`-${f.penalized}`);
      if (f.passed > 0) parts.push(`=${f.passed}`);
      return `${f.name}: ${parts.join('/')}`;
    });
    filterSummary = `\n  Filter impact: ${impacts.join(', ')}`;
  }

  logger.info(
    `[Pipeline] Execution: ${generatorName} produced ${generatedCount} → ` +
      `${filterCount} filters → ${finalCount} results (top scores: ${scoreDisplay})` +
      filterSummary +
      `\n  💡 Inspect: window.skuilder.pipeline`
  );
}

/**
 * Log all result cards with score, cardId, and key provenance.
 * Toggle: set VERBOSE_RESULTS = true to enable.
 */
const VERBOSE_RESULTS = true;

function logResultCards(cards: WeightedCard[]): void {
  if (!VERBOSE_RESULTS || cards.length === 0) return;

  logger.info(`[Pipeline] Results (${cards.length} cards):`);
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const tags = c.tags?.slice(0, 3).join(', ') || '';
    const filters = c.provenance
      .filter((p) => p.strategy === 'hierarchyDefinition' || p.strategy === 'priorityDefinition' || p.strategy === 'interferenceFilter' || p.strategy === 'letterGating')
      .map((p) => {
        const arrow = p.action === 'boosted' ? '↑' : p.action === 'penalized' ? '↓' : '=';
        return `${p.strategyName}${arrow}${p.score.toFixed(2)}`;
      })
      .join(' | ');
    logger.info(
      `[Pipeline]   ${String(i + 1).padStart(2)}. ${c.score.toFixed(4)}  ${c.cardId}  [${tags}]${filters ? `  {${filters}}` : ''}`
    );
  }
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
   * Cached orchestration context. Course config and salt don't change within
   * a page load, so we build the orchestration context once and reuse it on
   * subsequent getWeightedCards() calls (e.g. mid-session replans).
   *
   * This eliminates a remote getCourseConfig() round trip per pipeline run.
   */
  private _cachedOrchestration: OrchestrationContext | null = null;

  /**
   * Persistent tag cache. Maps cardId → tag names.
   *
   * Tags are static within a session (they're set at card generation time),
   * so we cache them across pipeline runs. On replans, many of the same cards
   * reappear — cache hits avoid redundant remote getAppliedTagsBatch() queries.
   */
  private _tagCache: Map<string, string[]> = new Map();

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
    const t0 = performance.now();

    // Build shared context once
    const context = await this.buildContext();
    const tContext = performance.now();

    // Over-fetch from generator to account for filtering
    const overFetchMultiplier = 2 + this.filters.length * 0.5;
    const fetchLimit = Math.ceil(limit * overFetchMultiplier);

    logger.debug(
      `[Pipeline] Fetching ${fetchLimit} candidates from generator '${this.generator.name}'`
    );

    // Get candidates from generator, passing context
    let cards = await this.generator.getWeightedCards(fetchLimit, context);
    const tGenerate = performance.now();
    const generatedCount = cards.length;
    
    // Capture generator breakdown for debugging (if CompositeGenerator)
    let generatorSummaries: GeneratorSummary[] | undefined;
    if ((this.generator as any).generators) {
      // This is a CompositeGenerator - extract per-generator info from provenance
      const genMap = new Map<string, { cards: WeightedCard[] }>();
      for (const card of cards) {
        const firstProv = card.provenance[0];
        if (firstProv) {
          const genName = firstProv.strategyName;
          if (!genMap.has(genName)) {
            genMap.set(genName, { cards: [] });
          }
          genMap.get(genName)!.cards.push(card);
        }
      }
      generatorSummaries = Array.from(genMap.entries()).map(([name, data]) => {
        const newCards = data.cards.filter((c) => c.provenance[0]?.reason?.includes('new card'));
        const reviewCards = data.cards.filter((c) => c.provenance[0]?.reason?.includes('review'));
        return {
          name,
          cardCount: data.cards.length,
          newCount: newCards.length,
          reviewCount: reviewCards.length,
          topScore: Math.max(...data.cards.map((c) => c.score), 0),
        };
      });
    }

    logger.debug(`[Pipeline] Generator returned ${generatedCount} candidates`);

    // Batch hydrate tags before filters run
    cards = await this.hydrateTags(cards);
    const tHydrate = performance.now();
    
    // Keep a copy of all cards for debug capture (before filtering removes any)
    const allCardsBeforeFiltering = [...cards];

    // Apply filters sequentially, tracking impact
    const filterImpacts: FilterImpact[] = [];
    for (const filter of this.filters) {
      const beforeCount = cards.length;
      const beforeScores = new Map(cards.map((c) => [c.cardId, c.score]));
      cards = await filter.transform(cards, context);
      
      // Count boost/penalize/pass/removed for this filter
      let boosted = 0, penalized = 0, passed = 0;
      const removed = beforeCount - cards.length;
      
      for (const card of cards) {
        const before = beforeScores.get(card.cardId) ?? 0;
        if (card.score > before) boosted++;
        else if (card.score < before) penalized++;
        else passed++;
      }
      filterImpacts.push({ name: filter.name, boosted, penalized, passed, removed });
      
      logger.debug(`[Pipeline] Filter '${filter.name}': ${beforeScores.size} → ${cards.length} cards (↑${boosted} ↓${penalized} =${passed})`);
    }

    // Remove zero-score cards (hard filtered)
    cards = cards.filter((c) => c.score > 0);

    // Sort by score descending
    cards.sort((a, b) => b.score - a.score);

    // Return top N
    const tFilter = performance.now();
    const result = cards.slice(0, limit);

    logger.info(
      `[Pipeline:timing] total=${(tFilter - t0).toFixed(0)}ms ` +
      `(context=${(tContext - t0).toFixed(0)} generate=${(tGenerate - tContext).toFixed(0)} ` +
      `hydrate=${(tHydrate - tGenerate).toFixed(0)} filter=${(tFilter - tHydrate).toFixed(0)})`
    );

    // Toggle execution summary logging:
    const topScores = result.slice(0, 3).map((c) => c.score);
    logExecutionSummary(
      this.generator.name,
      generatedCount,
      this.filters.length,
      result.length,
      topScores,
      filterImpacts
    );

    // Toggle verbose result listing:
    logResultCards(result);

    // Toggle provenance logging (shows scoring history for top cards):
    logCardProvenance(result, 3);

    // Capture run for debug API
    try {
      const courseName = await this.course?.getCourseConfig().then((c) => c.name).catch(() => undefined);
      const report = buildRunReport(
        this.course?.getCourseID() || 'unknown',
        courseName,
        this.generator.name,
        generatorSummaries,
        generatedCount,
        filterImpacts,
        allCardsBeforeFiltering,
        result
      );
      captureRun(report);
    } catch (e) {
      logger.debug(`[Pipeline] Failed to capture debug run: ${e}`);
    }

    return result;
  }

  /**
   * Batch hydrate tags for all cards.
   *
   * Fetches tags for all cards in a single database query and attaches them
   * to the WeightedCard objects. Filters can then use card.tags instead of
   * making individual getAppliedTags() calls.
   *
   * Uses a persistent tag cache across pipeline runs — tags are static within
   * a session, so cards seen in a prior run (e.g. before a replan) don't
   * require a second DB query.
   *
   * @param cards - Cards to hydrate
   * @returns Cards with tags populated
   */
  private async hydrateTags(cards: WeightedCard[]): Promise<WeightedCard[]> {
    if (cards.length === 0) {
      return cards;
    }

    // Separate cards with cached tags from those needing a DB query
    const uncachedIds: string[] = [];
    for (const card of cards) {
      if (!this._tagCache.has(card.cardId)) {
        uncachedIds.push(card.cardId);
      }
    }

    // Only query the DB for cards not already in cache
    if (uncachedIds.length > 0) {
      const freshTags = await this.course!.getAppliedTagsBatch(uncachedIds);
      for (const [cardId, tags] of freshTags) {
        this._tagCache.set(cardId, tags);
      }
    }

    // Build the tagsByCard map from cache (for logging compatibility)
    const tagsByCard = new Map<string, string[]>();
    for (const card of cards) {
      tagsByCard.set(card.cardId, this._tagCache.get(card.cardId) ?? []);
    }

    // Toggle tag hydration logging:
    logTagHydration(cards, tagsByCard);

    return cards.map((card) => ({
      ...card,
      tags: this._tagCache.get(card.cardId) ?? [],
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

    // Reuse cached orchestration context if available (course config is stable
    // within a page load). This avoids a remote getCourseConfig() call on
    // subsequent pipeline runs (e.g. mid-session replans).
    if (!this._cachedOrchestration) {
      this._cachedOrchestration = await createOrchestrationContext(this.user!, this.course!);
    }
    const orchestration = this._cachedOrchestration;

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
