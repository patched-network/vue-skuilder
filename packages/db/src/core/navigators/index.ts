import {
  StudyContentSource,
  UserDBInterface,
  CourseDBInterface,
  StudySessionReviewItem,
  StudySessionNewItem,
} from '..';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { ScheduledCard } from '../types/user';
import { logger } from '../../util/logger';

// ============================================================================
// NAVIGATION STRATEGY API
// ============================================================================
//
// This module defines the ContentNavigator base class and the WeightedCard type,
// which form the foundation of the pluggable navigation strategy system.
//
// KEY CONCEPTS:
//
// 1. WeightedCard - A card with a suitability score (0-1) and provenance trail.
//    The provenance tracks how each strategy in the pipeline contributed to
//    the card's final score, ensuring transparency and debuggability.
//
// 2. ContentNavigator - Abstract base class that strategies extend. Implements
//    StudyContentSource for backward compatibility.
//
// 3. Generator vs Filter strategies:
//    - Generators (ELO, SRS) produce candidate cards with scores
//    - Filters (Hierarchy, Interference, RelativePriority) wrap a delegate
//      and transform its output
//
// 4. Delegate pattern - Filter strategies compose by wrapping generators:
//    RelativePriority(Interference(Hierarchy(ELO)))
//
// 5. Provenance tracking - Each strategy adds an entry explaining its contribution.
//    This makes the system transparent and debuggable.
//
// API EVOLUTION:
// - getWeightedCards() is the PRIMARY API (new)
// - getNewCards() / getPendingReviews() are LEGACY (kept for backward compat)
// - SessionController will migrate to use getWeightedCards()
// - Legacy methods will eventually be deprecated
//
// See: ARCHITECTURE.md in this directory for full migration guide.
//
// ============================================================================

/**
 * Tracks a single strategy's contribution to a card's final score.
 *
 * Each strategy in the pipeline adds a StrategyContribution entry to the
 * card's provenance array, creating an audit trail of scoring decisions.
 */
export interface StrategyContribution {
  /** Which strategy processed this card (e.g., 'elo', 'hierarchyDefinition') */
  strategy: string;

  /**
   * What the strategy did:
   * - 'generated': Strategy produced this card (generators only)
   * - 'passed': Strategy evaluated but didn't change score (transparent pass-through)
   * - 'boosted': Strategy increased the score
   * - 'penalized': Strategy decreased the score
   */
  action: 'generated' | 'passed' | 'boosted' | 'penalized';

  /** Score after this strategy's processing */
  score: number;

  /**
   * Human-readable explanation of the strategy's decision.
   *
   * Examples:
   * - "ELO distance 75, new card"
   * - "Prerequisites met: letter-sounds"
   * - "Interferes with immature tag 'd' (decay 0.8)"
   * - "High-priority tag 's' (0.95) → boost 1.15x"
   *
   * Required for transparency - silent adjusters are anti-patterns.
   */
  reason: string;
}

/**
 * A card with a suitability score and provenance trail.
 *
 * Scores range from 0-1:
 * - 1.0 = fully suitable
 * - 0.0 = hard filter (e.g., prerequisite not met)
 * - 0.5 = neutral
 * - Intermediate values = soft preference
 *
 * Provenance tracks the scoring pipeline:
 * - First entry: Generator that produced the card
 * - Subsequent entries: Filters that transformed the score
 * - Each entry includes action and human-readable reason
 */
export interface WeightedCard {
  cardId: string;
  courseId: string;
  /** Suitability score from 0-1 */
  score: number;
  /**
   * Audit trail of strategy contributions.
   * First entry is from the generator, subsequent entries from filters.
   */
  provenance: StrategyContribution[];
}

/**
 * Extract card origin from provenance trail.
 *
 * The first provenance entry (from the generator) indicates whether
 * this is a new card, review, or failed card. We parse the reason
 * string to extract this information.
 *
 * @param card - Card with provenance trail
 * @returns Card origin ('new', 'review', or 'failed')
 */
export function getCardOrigin(card: WeightedCard): 'new' | 'review' | 'failed' {
  if (card.provenance.length === 0) {
    throw new Error('Card has no provenance - cannot determine origin');
  }

  const firstEntry = card.provenance[0];
  const reason = firstEntry.reason.toLowerCase();

  if (reason.includes('failed')) {
    return 'failed';
  }
  if (reason.includes('review')) {
    return 'review';
  }
  return 'new';
}

export enum Navigators {
  ELO = 'elo',
  HARDCODED = 'hardcodedOrder',
  HIERARCHY = 'hierarchyDefinition',
  INTERFERENCE = 'interferenceMitigator',
  RELATIVE_PRIORITY = 'relativePriority',
}

// ============================================================================
// NAVIGATOR ROLE CLASSIFICATION
// ============================================================================
//
// Navigators are classified as either generators or filters:
// - Generators: Produce candidate cards (ELO, SRS, HardcodedOrder)
// - Filters: Transform/score candidates from a delegate (all others)
//
// This classification enables automatic pipeline assembly:
// 1. Find the one generator
// 2. Chain all filters around it (order doesn't matter - all are multipliers)
//
// ============================================================================

/**
 * Role classification for navigation strategies.
 *
 * - GENERATOR: Produces candidate cards with initial scores
 * - FILTER: Wraps a delegate and transforms its scores (must be a multiplier)
 */
export enum NavigatorRole {
  GENERATOR = 'generator',
  FILTER = 'filter',
}

/**
 * Registry mapping navigator implementations to their roles.
 */
export const NavigatorRoles: Record<Navigators, NavigatorRole> = {
  [Navigators.ELO]: NavigatorRole.GENERATOR,
  [Navigators.HARDCODED]: NavigatorRole.GENERATOR,
  [Navigators.HIERARCHY]: NavigatorRole.FILTER,
  [Navigators.INTERFERENCE]: NavigatorRole.FILTER,
  [Navigators.RELATIVE_PRIORITY]: NavigatorRole.FILTER,
};

/**
 * Check if a navigator implementation is a generator.
 *
 * @param impl - Navigator implementation name (e.g., 'elo', 'hierarchyDefinition')
 * @returns true if the navigator is a generator, false otherwise
 */
export function isGenerator(impl: string): boolean {
  return NavigatorRoles[impl as Navigators] === NavigatorRole.GENERATOR;
}

/**
 * Check if a navigator implementation is a filter.
 *
 * @param impl - Navigator implementation name (e.g., 'elo', 'hierarchyDefinition')
 * @returns true if the navigator is a filter, false otherwise
 */
export function isFilter(impl: string): boolean {
  return NavigatorRoles[impl as Navigators] === NavigatorRole.FILTER;
}

/**
 * Abstract base class for navigation strategies that steer study sessions.
 *
 * ContentNavigator implements StudyContentSource for backward compatibility,
 * but the primary API going forward is getWeightedCards().
 *
 * ## Strategy Types
 *
 * **Generator strategies** produce candidate cards:
 * - Override getWeightedCards() to generate and score candidates
 * - Examples: ELO (skill proximity), SRS (review scheduling)
 *
 * **Filter strategies** transform delegate output:
 * - Wrap another strategy via the delegate pattern
 * - Override getWeightedCards() to filter/adjust delegate scores
 * - Examples: HierarchyDefinition, InterferenceMitigator, RelativePriority
 *
 * ## API Migration
 *
 * The legacy getNewCards()/getPendingReviews() methods exist for backward
 * compatibility with SessionController. Once SessionController migrates to
 * use getWeightedCards(), these methods will be deprecated.
 *
 * New strategies should:
 * 1. Implement getWeightedCards() as the primary logic
 * 2. Optionally override legacy methods (base class provides defaults)
 *
 * See: ARCHITECTURE.md for full migration guide and design rationale.
 */
export abstract class ContentNavigator implements StudyContentSource {
  /**
   *
   * @param user
   * @param strategyData
   * @returns the runtime object used to steer a study session.
   */
  static async create(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ): Promise<ContentNavigator> {
    const implementingClass = strategyData.implementingClass;
    let NavigatorImpl;

    // Try different extension variations
    const variations = ['.ts', '.js', ''];

    for (const ext of variations) {
      try {
        const module = await import(`./${implementingClass}${ext}`);
        NavigatorImpl = module.default;
        break; // Break the loop if loading succeeds
      } catch (e) {
        // Continue to next variation if this one fails
        logger.debug(`Failed to load with extension ${ext}:`, e);
      }
    }

    if (!NavigatorImpl) {
      throw new Error(`Could not load navigator implementation for: ${implementingClass}`);
    }

    return new NavigatorImpl(user, course, strategyData);
  }

  /**
   * Get cards scheduled for review.
   *
   * @deprecated This method is part of the legacy StudyContentSource interface.
   * New strategies should focus on implementing getWeightedCards() instead.
   * This method will be deprecated once SessionController migrates to the new API.
   *
   * For filter strategies using the delegate pattern, this can simply delegate
   * to the wrapped strategy.
   */
  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;

  /**
   * Get new cards for introduction.
   *
   * @deprecated This method is part of the legacy StudyContentSource interface.
   * New strategies should focus on implementing getWeightedCards() instead.
   * This method will be deprecated once SessionController migrates to the new API.
   *
   * For filter strategies using the delegate pattern, this can simply delegate
   * to the wrapped strategy.
   *
   * @param n - Maximum number of new cards to return
   */
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;

  /**
   * Get cards with suitability scores and provenance trails.
   *
   * **This is the PRIMARY API for navigation strategies.**
   *
   * Returns cards ranked by suitability score (0-1). Higher scores indicate
   * better candidates for presentation. Each card includes a provenance trail
   * documenting how strategies contributed to the final score.
   *
   * ## For Generator Strategies
   * Override this method to generate candidates and compute scores based on
   * your strategy's logic (e.g., ELO proximity, review urgency). Create the
   * initial provenance entry with action='generated'.
   *
   * ## For Filter Strategies
   * Override this method to:
   * 1. Get candidates from delegate: `delegate.getWeightedCards(limit * N)`
   * 2. Transform/filter scores based on your logic
   * 3. Append provenance entry documenting your contribution
   * 4. Re-sort and return top candidates
   *
   * ## Default Implementation
   * The base class provides a backward-compatible default that:
   * 1. Calls legacy getNewCards() and getPendingReviews()
   * 2. Assigns score=1.0 to all cards
   * 3. Creates minimal provenance from legacy methods
   * 4. Returns combined results up to limit
   *
   * This allows existing strategies to work without modification while
   * new strategies can override with proper scoring and provenance.
   *
   * @param limit - Maximum cards to return
   * @returns Cards sorted by score descending, with provenance trails
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Default implementation: delegate to legacy methods, assign score=1.0
    const newCards = await this.getNewCards(limit);
    const reviews = await this.getPendingReviews();

    const weighted: WeightedCard[] = [
      ...newCards.map((c) => ({
        cardId: c.cardID,
        courseId: c.courseID,
        score: 1.0,
        provenance: [
          {
            strategy: 'legacy',
            action: 'generated' as const,
            score: 1.0,
            reason: 'Generated via legacy getNewCards(), new card',
          },
        ],
      })),
      ...reviews.map((r) => ({
        cardId: r.cardID,
        courseId: r.courseID,
        score: 1.0,
        provenance: [
          {
            strategy: 'legacy',
            action: 'generated' as const,
            score: 1.0,
            reason: 'Generated via legacy getPendingReviews(), review',
          },
        ],
      })),
    ];

    return weighted.slice(0, limit);
  }
}
