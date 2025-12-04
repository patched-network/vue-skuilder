import {
  StudyContentSource,
  UserDBInterface,
  CourseDBInterface,
  StudySessionReviewItem,
  StudySessionNewItem,
} from '..';

// Re-export filter types
export { CardFilter, FilterContext, CardFilterFactory } from './filters/types';

// Re-export generator types
export { CardGenerator, GeneratorContext, CardGeneratorFactory } from './generators/types';

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
// 2. ContentNavigator - Abstract base class for backward compatibility.
//    New code should use CardGenerator or CardFilter interfaces directly.
//
// 3. CardGenerator vs CardFilter:
//    - Generators (ELO, SRS, HardcodedOrder) produce candidate cards with scores
//    - Filters (Hierarchy, Interference, Priority, EloDistance) transform scores
//
// 4. Pipeline architecture:
//    Pipeline(generator, [filter1, filter2, ...]) executes:
//      cards = generator.getWeightedCards()
//      cards = filter1.transform(cards, context)
//      cards = filter2.transform(cards, context)
//      return sorted(cards)
//
// 5. Provenance tracking - Each strategy adds an entry explaining its contribution.
//    This makes the system transparent and debuggable.
//
// ============================================================================

/**
 * Tracks a single strategy's contribution to a card's final score.
 *
 * Each strategy in the pipeline adds a StrategyContribution entry to the
 * card's provenance array, creating an audit trail of scoring decisions.
 */
export interface StrategyContribution {
  /**
   * Strategy type (implementing class name).
   * Examples: 'elo', 'hierarchyDefinition', 'interferenceMitigator'
   */
  strategy: string;

  /**
   * Human-readable name identifying this specific strategy instance.
   * Extracted from ContentNavigationStrategyData.name.
   * Courses may have multiple instances of the same strategy type with
   * different configurations.
   *
   * Examples:
   * - "ELO (default)"
   * - "Interference: b/d/p confusion"
   * - "Interference: phonetic confusables"
   * - "Priority: Common letters first"
   */
  strategyName: string;

  /**
   * Unique database document ID for this strategy instance.
   * Extracted from ContentNavigationStrategyData._id.
   * Use this to fetch the full strategy configuration document.
   *
   * Examples:
   * - "NAVIGATION_STRATEGY-ELO-default"
   * - "NAVIGATION_STRATEGY-interference-bdp"
   * - "NAVIGATION_STRATEGY-priority-common-letters"
   */
  strategyId: string;

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
  SRS = 'srs',
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
// - Filters: Transform/score candidates (Hierarchy, Interference, RelativePriority)
//
// This classification is used by PipelineAssembler to build pipelines:
// 1. Instantiate generators (possibly into a CompositeGenerator)
// 2. Instantiate filters
// 3. Create Pipeline(generator, filters)
//
// ============================================================================

/**
 * Role classification for navigation strategies.
 *
 * - GENERATOR: Produces candidate cards with initial scores
 * - FILTER: Transforms cards with score multipliers
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
  [Navigators.SRS]: NavigatorRole.GENERATOR,
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
 * Abstract base class for navigation strategies.
 *
 * This class exists primarily for backward compatibility with legacy code.
 * New code should use CardGenerator or CardFilter interfaces directly.
 *
 * The class implements StudyContentSource for compatibility with SessionController.
 * Once SessionController migrates to use getWeightedCards() exclusively,
 * the legacy methods can be removed.
 */
export abstract class ContentNavigator implements StudyContentSource {
  /** User interface for this navigation session */
  protected user?: UserDBInterface;

  /** Course interface for this navigation session */
  protected course?: CourseDBInterface;

  /** Human-readable name for this strategy instance (from ContentNavigationStrategyData.name) */
  protected strategyName?: string;

  /** Unique document ID for this strategy instance (from ContentNavigationStrategyData._id) */
  protected strategyId?: string;

  /**
   * Constructor for standard navigators.
   * Call this from subclass constructors to initialize common fields.
   *
   * Note: CompositeGenerator doesn't use this pattern and should call super() without args.
   */
  constructor(
    user?: UserDBInterface,
    course?: CourseDBInterface,
    strategyData?: ContentNavigationStrategyData
  ) {
    if (user && course && strategyData) {
      this.user = user;
      this.course = course;
      this.strategyName = strategyData.name;
      this.strategyId = strategyData._id;
    }
  }

  /**
   * Factory method to create navigator instances dynamically.
   *
   * @param user - User interface
   * @param course - Course interface
   * @param strategyData - Strategy configuration document
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
   * New strategies should focus on implementing CardGenerator.getWeightedCards() instead.
   */
  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;

  /**
   * Get new cards for introduction.
   *
   * @deprecated This method is part of the legacy StudyContentSource interface.
   * New strategies should focus on implementing CardGenerator.getWeightedCards() instead.
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
   * ## For Generators
   * Override this method to generate candidates and compute scores based on
   * your strategy's logic (e.g., ELO proximity, review urgency). Create the
   * initial provenance entry with action='generated'.
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
            strategyName: this.strategyName || 'Legacy API',
            strategyId: this.strategyId || 'legacy-fallback',
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
            strategyName: this.strategyName || 'Legacy API',
            strategyId: this.strategyId || 'legacy-fallback',
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
