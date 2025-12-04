import { toCourseElo } from '@vue-skuilder/common';
import { StudyContentSource } from '../interfaces/contentSource';
import { CourseDBInterface } from '../interfaces/courseDB';
import { UserDBInterface } from '../interfaces/userDB';
import { ScheduledCard } from '../types/user';
import { ContentNavigator, WeightedCard } from './index';
import { CardFilter, FilterContext } from './filters/types';
import { StudySessionNewItem, StudySessionReviewItem } from '../interfaces/contentSource';
import { logger } from '../../util/logger';

// ============================================================================
// PIPELINE
// ============================================================================
//
// Executes a navigation pipeline: generator → filters → sorted results.
//
// This replaces the delegate-wrapping pattern with a simpler model:
//
//   OLD (complex):
//     Filter3(delegate=Filter2(delegate=Filter1(delegate=Generator)))
//
//   NEW (simple):
//     cards = generator.getWeightedCards()
//     cards = filter1.transform(cards, context)
//     cards = filter2.transform(cards, context)
//     cards = filter3.transform(cards, context)
//
// Benefits:
// - No nested instantiation complexity
// - Filters don't need to know about delegates
// - Easy to add/remove/reorder filters
// - Shared context built once, passed to all filters
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
export class Pipeline implements StudyContentSource {
  private generator: ContentNavigator;
  private filters: CardFilter[];
  private user: UserDBInterface;
  private course: CourseDBInterface;

  /**
   * Create a new pipeline.
   *
   * @param generator - The generator (or CompositeGenerator) that produces candidates
   * @param filters - Filters to apply sequentially (order doesn't matter for multipliers)
   * @param user - User database interface
   * @param course - Course database interface
   */
  constructor(
    generator: ContentNavigator,
    filters: CardFilter[],
    user: UserDBInterface,
    course: CourseDBInterface
  ) {
    this.generator = generator;
    this.filters = filters;
    this.user = user;
    this.course = course;

    logger.debug(
      `[Pipeline] Created with generator and ${filters.length} filters: ${filters.map((f) => f.name).join(', ')}`
    );
  }

  /**
   * Get weighted cards by running generator and applying filters.
   *
   * 1. Build shared context (user ELO, etc.)
   * 2. Get candidates from generator
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

    logger.debug(`[Pipeline] Fetching ${fetchLimit} candidates from generator`);

    // Get candidates from generator
    let cards = await this.generator.getWeightedCards(fetchLimit);

    logger.debug(`[Pipeline] Generator returned ${cards.length} candidates`);

    // Apply filters sequentially
    for (const filter of this.filters) {
      const beforeCount = cards.length;
      cards = await filter.transform(cards, context);
      logger.debug(
        `[Pipeline] Filter '${filter.name}': ${beforeCount} → ${cards.length} cards`
      );
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
   * Build shared context for filters.
   *
   * Called once per getWeightedCards() invocation.
   * Contains data that multiple filters might need.
   */
  private async buildContext(): Promise<FilterContext> {
    let userElo = 1000; // Default ELO

    try {
      const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
      const courseElo = toCourseElo(courseReg.elo);
      userElo = courseElo.global.score;
    } catch (e) {
      logger.debug(`[Pipeline] Could not get user ELO, using default: ${e}`);
    }

    return {
      user: this.user,
      course: this.course,
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
   * Delegates to the generator.
   */
  async getNewCards(n?: number): Promise<StudySessionNewItem[]> {
    return this.generator.getNewCards(n);
  }

  /**
   * Get pending reviews via legacy API.
   * Delegates to the generator.
   */
  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    return this.generator.getPendingReviews();
  }
}
