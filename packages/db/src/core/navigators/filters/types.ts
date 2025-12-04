import { WeightedCard } from '../index';
import { CourseDBInterface } from '../../interfaces/courseDB';
import { UserDBInterface } from '../../interfaces/userDB';

// ============================================================================
// CARD FILTER INTERFACE
// ============================================================================
//
// Filters are pure transforms on a list of WeightedCards.
// They replace the delegate-wrapping pattern with a simpler model:
//
//   cards = Generator.getWeightedCards()
//   cards = Filter1.transform(cards, context)
//   cards = Filter2.transform(cards, context)
//
// Benefits:
// - No nested instantiation
// - Filters don't need to know about delegates
// - Easy to add/remove/reorder filters
// - Natural place to hydrate shared data before filter pass
//
// All filters should be score multipliers (including score: 0 for exclusion).
// This means filter order doesn't affect final scores.
//
// ============================================================================

/**
 * Shared context available to all filters in a pipeline.
 *
 * Built once per getWeightedCards() call and passed to each filter.
 * This avoids repeated lookups for common data like user ELO.
 */
export interface FilterContext {
  /** User database interface */
  user: UserDBInterface;

  /** Course database interface */
  course: CourseDBInterface;

  /** User's global ELO score for this course */
  userElo: number;

  // Future extensions:
  // - hydrated tags for all cards (batch lookup)
  // - user's tag-level ELO data
  // - course config
}

/**
 * A filter that transforms a list of weighted cards.
 *
 * Filters are pure transforms - they receive cards and context,
 * and return a modified list of cards. No delegate wrapping,
 * no side effects beyond provenance tracking.
 *
 * ## Implementation Guidelines
 *
 * 1. **Append provenance**: Every filter should add a StrategyContribution
 *    entry documenting its decision for each card.
 *
 * 2. **Use multipliers**: Adjust scores by multiplying, not replacing.
 *    This ensures filter order doesn't matter.
 *
 * 3. **Score 0 for exclusion**: To exclude a card, set score to 0.
 *    Don't filter it out - let provenance show why it was excluded.
 *
 * 4. **Don't sort**: The Pipeline handles final sorting.
 *    Filters just transform scores.
 *
 * ## Example Implementation
 *
 * ```typescript
 * const myFilter: CardFilter = {
 *   name: 'My Filter',
 *   async transform(cards, context) {
 *     return cards.map(card => {
 *       const multiplier = computeMultiplier(card, context);
 *       const newScore = card.score * multiplier;
 *       return {
 *         ...card,
 *         score: newScore,
 *         provenance: [...card.provenance, {
 *           strategy: 'myFilter',
 *           strategyName: 'My Filter',
 *           strategyId: 'MY_FILTER',
 *           action: multiplier < 1 ? 'penalized' : 'passed',
 *           score: newScore,
 *           reason: 'Explanation of decision'
 *         }]
 *       };
 *     });
 *   }
 * };
 * ```
 */
export interface CardFilter {
  /** Human-readable name for this filter */
  name: string;

  /**
   * Transform a list of weighted cards.
   *
   * @param cards - Cards to transform (already scored by generator)
   * @param context - Shared context (user, course, userElo, etc.)
   * @returns Transformed cards with updated scores and provenance
   */
  transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]>;
}

/**
 * Factory function type for creating filters from configuration.
 *
 * Used by PipelineAssembler to instantiate filters from strategy documents.
 */
export type CardFilterFactory<TConfig = unknown> = (config: TConfig) => CardFilter;
