import type { WeightedCard } from '../index';
import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';

// ============================================================================
// CARD GENERATOR INTERFACE
// ============================================================================
//
// Generators produce candidate cards with initial scores.
// They are the "source" stage of a navigation pipeline.
//
// Examples: ELO (skill proximity), SRS (review scheduling), HardcodedOrder
//
// Generators differ from filters:
// - Generators: produce candidates from DB queries, assign initial scores
// - Filters: transform existing candidates, adjust scores with multipliers
//
// The Pipeline class orchestrates: Generator → Filter₁ → Filter₂ → ... → Results
//
// ============================================================================

/**
 * Context available to generators when producing candidates.
 *
 * Built once per getWeightedCards() call by the Pipeline.
 */
export interface GeneratorContext {
  /** User database interface */
  user: UserDBInterface;

  /** Course database interface */
  course: CourseDBInterface;

  /** User's global ELO score for this course */
  userElo: number;

  // Future extensions:
  // - user's tag-level ELO data
  // - course config
  // - session state (cards already seen this session)
}

/**
 * A generator that produces candidate cards with initial scores.
 *
 * Generators are the "source" stage of a navigation pipeline.
 * They query the database for eligible cards and assign initial
 * suitability scores based on their strategy (ELO proximity,
 * review urgency, fixed order, etc.).
 *
 * ## Implementation Guidelines
 *
 * 1. **Create provenance**: Each card should have a provenance entry
 *    with action='generated' documenting why it was selected.
 *
 * 2. **Score semantics**: Higher scores = more suitable for presentation.
 *    Scores should be in [0, 1] range for composability.
 *
 * 3. **Limit handling**: Respect the limit parameter, but may over-fetch
 *    internally if needed for scoring accuracy.
 *
 * 4. **Sort before returning**: Return cards sorted by score descending.
 *
 * ## Example Implementation
 *
 * ```typescript
 * const myGenerator: CardGenerator = {
 *   name: 'My Generator',
 *   async getWeightedCards(limit, context) {
 *     const candidates = await fetchCandidates(context.course, limit);
 *     return candidates.map(c => ({
 *       cardId: c.id,
 *       courseId: context.course.getCourseID(),
 *       score: computeScore(c, context),
 *       provenance: [{
 *         strategy: 'myGenerator',
 *         strategyName: 'My Generator',
 *         strategyId: 'MY_GENERATOR',
 *         action: 'generated',
 *         score: computeScore(c, context),
 *         reason: 'Explanation of selection'
 *       }]
 *     }));
 *   }
 * };
 * ```
 */
export interface CardGenerator {
  /** Human-readable name for this generator */
  name: string;

  /**
   * Produce candidate cards with initial scores.
   *
   * @param limit - Maximum number of cards to return
   * @param context - Shared context (user, course, userElo, etc.)
   * @returns Cards sorted by score descending, with provenance
   */
  getWeightedCards(limit: number, context: GeneratorContext): Promise<WeightedCard[]>;
}

/**
 * Factory function type for creating generators from configuration.
 *
 * Used by PipelineAssembler to instantiate generators from strategy documents.
 */
export type CardGeneratorFactory<TConfig = unknown> = (config: TConfig) => CardGenerator;
