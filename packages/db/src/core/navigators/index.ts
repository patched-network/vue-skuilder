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
// 1. WeightedCard - A card with a suitability score (0-1). This is the unified
//    output format for all navigation strategies.
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
 * A card with a suitability score for presentation.
 *
 * Scores range from 0-1:
 * - 1.0 = fully suitable
 * - 0.0 = hard filter (e.g., prerequisite not met)
 * - 0.5 = neutral
 * - Intermediate values = soft preference
 */
export interface WeightedCard {
  cardId: string;
  courseId: string;
  /** Suitability score from 0-1 */
  score: number;
  /** Origin of the card */
  source: 'new' | 'review' | 'failed';
}

export enum Navigators {
  ELO = 'elo',
  HARDCODED = 'hardcodedOrder',
  HIERARCHY = 'hierarchyDefinition',
  INTERFERENCE = 'interferenceMitigator',
  RELATIVE_PRIORITY = 'relativePriority',
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
   * Get cards with suitability scores.
   *
   * **This is the PRIMARY API for navigation strategies.**
   *
   * Returns cards ranked by suitability score (0-1). Higher scores indicate
   * better candidates for presentation.
   *
   * ## For Generator Strategies
   * Override this method to generate candidates and compute scores based on
   * your strategy's logic (e.g., ELO proximity, review urgency).
   *
   * ## For Filter Strategies
   * Override this method to:
   * 1. Get candidates from delegate: `delegate.getWeightedCards(limit * N)`
   * 2. Transform/filter scores based on your logic
   * 3. Re-sort and return top candidates
   *
   * ## Default Implementation
   * The base class provides a backward-compatible default that:
   * 1. Calls legacy getNewCards() and getPendingReviews()
   * 2. Assigns score=1.0 to all cards
   * 3. Returns combined results up to limit
   *
   * This allows existing strategies to work without modification while
   * new strategies can override with proper scoring.
   *
   * @param limit - Maximum cards to return
   * @returns Cards sorted by score descending
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
        source: 'new' as const,
      })),
      ...reviews.map((r) => ({
        cardId: r.cardID,
        courseId: r.courseID,
        score: 1.0,
        source: 'review' as const,
      })),
    ];

    return weighted.slice(0, limit);
  }
}
