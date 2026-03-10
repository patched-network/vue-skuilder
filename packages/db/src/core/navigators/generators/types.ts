import type { WeightedCard } from '../index';
import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import type { OrchestrationContext } from '../../orchestration';

/**
 * Typed ephemeral pipeline hints for a single run.
 * All fields are optional. Tag/card patterns support `*` wildcards.
 */
export interface ReplanHints {
  /** Multiply scores for cards matching these tag patterns. */
  boostTags?: Record<string, number>;
  /** Multiply scores for these specific card IDs (glob patterns). */
  boostCards?: Record<string, number>;
  /** Cards matching these tag patterns MUST appear in results. */
  requireTags?: string[];
  /** These specific card IDs MUST appear in results. */
  requireCards?: string[];
  /** Remove cards matching these tag patterns from results. */
  excludeTags?: string[];
  /** Remove these specific card IDs from results. */
  excludeCards?: string[];
  /**
   * Debugging label threaded from the replan requester.
   * Prefixed with `_` to signal it's metadata, not a scoring hint.
   */
  _label?: string;
}

// ============================================================================
// CARD GENERATOR INTERFACE
// ============================================================================
//
// Generators produce candidate cards with initial scores.
// They are the "source" stage of a navigation pipeline.
//
// Examples: ELO (skill proximity), SRS (review scheduling)
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

  /** Orchestration context for evolutionary weighting */
  orchestration?: OrchestrationContext;

  // Future extensions:
  // - user's tag-level ELO data
  // - course config
  // - session state (cards already seen this session)
}

/**
 * Structured generator result.
 *
 * Generators may optionally emit one-shot replan hints alongside their
 * candidate cards. This allows a generator to shape the broader pipeline
 * without having to enumerate every affected support card directly.
 */
export interface GeneratorResult {
  /** Candidate cards produced by the generator */
  cards: WeightedCard[];

  /** Optional one-shot hints to apply after the filter chain */
  hints?: ReplanHints;
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
 * 5. **Hints are optional**: Generators may return structured results with
 *    `hints` when they need to apply pipeline-wide ephemeral pressure.
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
   * @returns Cards sorted by score descending, with provenance, optionally
   *          accompanied by one-shot replan hints
   */
  getWeightedCards(
    limit: number,
    context: GeneratorContext
  ): Promise<GeneratorResult>;
}

/**
 * Factory function type for creating generators from configuration.
 *
 * Used by PipelineAssembler to instantiate generators from strategy documents.
 */
export type CardGeneratorFactory<TConfig = unknown> = (config: TConfig) => CardGenerator;
