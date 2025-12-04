import { toCourseElo } from '@vue-skuilder/common';
import type { CourseDBInterface } from '../interfaces/courseDB';
import type { UserDBInterface } from '../interfaces/userDB';
import type { ScheduledCard } from '../types/user';
import { ContentNavigator } from './index';
import type { WeightedCard } from './index';
import type { CardFilter, FilterContext } from './filters/types';
import type { CardGenerator, GeneratorContext } from './generators/types';
import type { StudySessionNewItem, StudySessionReviewItem } from '../interfaces/contentSource';
import { logger } from '../../util/logger';

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

    logger.debug(
      `[Pipeline] Created with generator '${generator.name}' and ${filters.length} filters: ${filters.map((f) => f.name).join(', ')}`
    );
  }

  /**
   * Get weighted cards by running generator and applying filters.
   *
   * 1. Build shared context (user ELO, etc.)
   * 2. Get candidates from generator (passing context)
   * 3. Apply each filter sequentially
   * 4. Remove zero-score cards
   * 5. Sort by score descending
   * 6. Return top N
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

    logger.debug(`[Pipeline] Generator returned ${cards.length} candidates`);

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

    logger.debug(
      `[Pipeline] Returning ${result.length} cards (top scores: ${result
        .slice(0, 3)
        .map((c) => c.score.toFixed(2))
        .join(', ')}...)`
    );

    return result;
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

    return {
      user: this.user!,
      course: this.course!,
      userElo,
    };
  }

  // ===========================================================================
  // Legacy StudyContentSource methods
  // ===========================================================================
  //
  // These delegate to the generator for backward compatibility.
  // Eventually SessionController will use getWeightedCards() exclusively.
  //

  /**
   * Get new cards via legacy API.
   * Delegates to the generator if it supports the legacy interface.
   */
  async getNewCards(n?: number): Promise<StudySessionNewItem[]> {
    // Check if generator has legacy method (ContentNavigator-based generators do)
    if ('getNewCards' in this.generator && typeof this.generator.getNewCards === 'function') {
      return (this.generator as ContentNavigator).getNewCards(n);
    }
    // Pure CardGenerator without legacy support - return empty
    return [];
  }

  /**
   * Get pending reviews via legacy API.
   * Delegates to the generator if it supports the legacy interface.
   */
  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    // Check if generator has legacy method (ContentNavigator-based generators do)
    if (
      'getPendingReviews' in this.generator &&
      typeof this.generator.getPendingReviews === 'function'
    ) {
      return (this.generator as ContentNavigator).getPendingReviews();
    }
    // Pure CardGenerator without legacy support - return empty
    return [];
  }

  /**
   * Get the course ID for this pipeline.
   */
  getCourseID(): string {
    return this.course!.getCourseID();
  }
}
