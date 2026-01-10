import { StudyContentSource, UserDBInterface, CourseDBInterface } from '..';

// Re-export filter types
export type { CardFilter, FilterContext, CardFilterFactory } from './filters/types';

// Re-export generator types
export type { CardGenerator, GeneratorContext, CardGeneratorFactory } from './generators/types';

import { LearnableWeight } from '../types/contentNavigationStrategy';
export type { ContentNavigationStrategyData, LearnableWeight } from '../types/contentNavigationStrategy';
import type { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { logger } from '../../util/logger';

// ============================================================================
// NAVIGATOR REGISTRY
// ============================================================================
//
// Static registry of navigator implementations. This allows ContentNavigator.create()
// to instantiate navigators without relying on dynamic imports, which don't work
// reliably in all environments (e.g., test runners, bundled code).
//
// Usage:
// 1. Import your navigator class
// 2. Call registerNavigator('implementingClass', YourNavigatorClass)
// 3. ContentNavigator.create() will use the registry before falling back to
//    dynamic import
//
// ============================================================================

/**
 * Type for navigator constructor functions.
 */
export type NavigatorConstructor = new (
  user: UserDBInterface,
  course: CourseDBInterface,
  strategyData: ContentNavigationStrategyData
) => ContentNavigator;

/**
 * Registry mapping implementingClass names to navigator constructors.
 * Populated by registerNavigator() and used by ContentNavigator.create().
 */
const navigatorRegistry = new Map<string, NavigatorConstructor>();

/**
 * Register a navigator implementation.
 *
 * Call this to make a navigator available for instantiation by
 * ContentNavigator.create() without relying on dynamic imports.
 *
 * @param implementingClass - The class name (e.g., 'elo', 'hierarchyDefinition')
 * @param constructor - The navigator class constructor
 */
export function registerNavigator(
  implementingClass: string,
  constructor: NavigatorConstructor
): void {
  navigatorRegistry.set(implementingClass, constructor);
  logger.debug(`[NavigatorRegistry] Registered: ${implementingClass}`);
}

/**
 * Get a navigator constructor from the registry.
 *
 * @param implementingClass - The class name to look up
 * @returns The constructor, or undefined if not registered
 */
export function getRegisteredNavigator(implementingClass: string): NavigatorConstructor | undefined {
  return navigatorRegistry.get(implementingClass);
}

/**
 * Check if a navigator is registered.
 *
 * @param implementingClass - The class name to check
 * @returns true if registered, false otherwise
 */
export function hasRegisteredNavigator(implementingClass: string): boolean {
  return navigatorRegistry.has(implementingClass);
}

/**
 * Get all registered navigator names.
 * Useful for debugging and testing.
 */
export function getRegisteredNavigatorNames(): string[] {
  return Array.from(navigatorRegistry.keys());
}

/**
 * Initialize the navigator registry with all built-in navigators.
 *
 * This function dynamically imports all standard navigator implementations
 * and registers them. Call this once at application startup to ensure
 * all navigators are available.
 *
 * In test environments, this may need to be called explicitly before
 * using ContentNavigator.create().
 */
export async function initializeNavigatorRegistry(): Promise<void> {
  logger.debug('[NavigatorRegistry] Initializing built-in navigators...');

  // Import and register generators
  const [eloModule, srsModule] = await Promise.all([
    import('./generators/elo'),
    import('./generators/srs'),
  ]);
  registerNavigator('elo', eloModule.default);
  registerNavigator('srs', srsModule.default);

  // Import and register filters
  const [
    hierarchyModule,
    interferenceModule,
    relativePriorityModule,
    userTagPreferenceModule,
  ] = await Promise.all([
    import('./filters/hierarchyDefinition'),
    import('./filters/interferenceMitigator'),
    import('./filters/relativePriority'),
    import('./filters/userTagPreference'),
  ]);
  registerNavigator('hierarchyDefinition', hierarchyModule.default);
  registerNavigator('interferenceMitigator', interferenceModule.default);
  registerNavigator('relativePriority', relativePriorityModule.default);
  registerNavigator('userTagPreference', userTagPreferenceModule.default);

  // Note: eloDistance uses a factory pattern (createEloDistanceFilter) rather than
  // a ContentNavigator class, so it's not registered here. It's used differently
  // via Pipeline composition.

  logger.debug(
    `[NavigatorRegistry] Initialized ${navigatorRegistry.size} navigators: ${getRegisteredNavigatorNames().join(', ')}`
  );
}

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
//    - Generators (ELO, SRS) produce candidate cards with scores
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
   * The effective weight applied for this strategy instance.
   * If using evolutionary orchestration, this includes deviation.
   * If omitted, implies weight 1.0 (legacy behavior).
   */
  effectiveWeight?: number;

  /**
   * The deviation factor applied to this user's cohort for this strategy.
   * Range [-1.0, 1.0].
   */
  deviation?: number;

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
  /**
   * Pre-fetched tags. Populated by Pipeline before filters run.
   * Filters should use this instead of querying getAppliedTags() individually.
   */
  tags?: string[];
  /**
   * Review document ID (_id from ScheduledCard).
   * Present when this card originated from SRS review scheduling.
   * Used by SessionController to track review outcomes and maintain review state.
   */
  reviewID?: string;
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
  HIERARCHY = 'hierarchyDefinition',
  INTERFERENCE = 'interferenceMitigator',
  RELATIVE_PRIORITY = 'relativePriority',
  USER_TAG_PREFERENCE = 'userTagPreference',
}

// ============================================================================
// NAVIGATOR ROLE CLASSIFICATION
// ============================================================================
//
// Navigators are classified as either generators or filters:
// - Generators: Produce candidate cards (ELO, SRS)
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
  [Navigators.HIERARCHY]: NavigatorRole.FILTER,
  [Navigators.INTERFERENCE]: NavigatorRole.FILTER,
  [Navigators.RELATIVE_PRIORITY]: NavigatorRole.FILTER,
  [Navigators.USER_TAG_PREFERENCE]: NavigatorRole.FILTER,
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
  protected user: UserDBInterface;

  /** Course interface for this navigation session */
  protected course: CourseDBInterface;

  /** Human-readable name for this strategy instance (from ContentNavigationStrategyData.name) */
  protected strategyName?: string;

  /** Unique document ID for this strategy instance (from ContentNavigationStrategyData._id) */
  protected strategyId?: string;

  /** Evolutionary weighting configuration */
  public learnable?: LearnableWeight;

  /** Whether to bypass deviation (manual/static weighting) */
  public staticWeight?: boolean;

  /**
   * Constructor for standard navigators.
   * Call this from subclass constructors to initialize common fields.
   *
   * Note: CompositeGenerator and Pipeline call super() without args, then set
   * user/course fields directly if needed.
   */
  constructor(
    user?: UserDBInterface,
    course?: CourseDBInterface,
    strategyData?: ContentNavigationStrategyData
  ) {
    this.user = user!;
    this.course = course!;
    if (strategyData) {
      this.strategyName = strategyData.name;
      this.strategyId = strategyData._id;
      this.learnable = strategyData.learnable;
      this.staticWeight = strategyData.staticWeight;
    }
  }

  // ============================================================================
  // STRATEGY STATE HELPERS
  // ============================================================================
  //
  // These methods allow strategies to persist their own state (user preferences,
  // learned patterns, temporal tracking) in the user database.
  //
  // ============================================================================

  /**
   * Unique key identifying this strategy for state storage.
   *
   * Defaults to the constructor name (e.g., "UserTagPreferenceFilter").
   * Override in subclasses if multiple instances of the same strategy type
   * need separate state storage.
   */
  protected get strategyKey(): string {
    return this.constructor.name;
  }

  /**
   * Get this strategy's persisted state for the current course.
   *
   * @returns The strategy's data payload, or null if no state exists
   * @throws Error if user or course is not initialized
   */
  protected async getStrategyState<T>(): Promise<T | null> {
    if (!this.user || !this.course) {
      throw new Error(
        `Cannot get strategy state: navigator not properly initialized. ` +
          `Ensure user and course are provided to constructor.`
      );
    }
    return this.user.getStrategyState<T>(this.course.getCourseID(), this.strategyKey);
  }

  /**
   * Persist this strategy's state for the current course.
   *
   * @param data - The strategy's data payload to store
   * @throws Error if user or course is not initialized
   */
  protected async putStrategyState<T>(data: T): Promise<void> {
    if (!this.user || !this.course) {
      throw new Error(
        `Cannot put strategy state: navigator not properly initialized. ` +
          `Ensure user and course are provided to constructor.`
      );
    }
    return this.user.putStrategyState<T>(this.course.getCourseID(), this.strategyKey, data);
  }

  /**
   * Factory method to create navigator instances.
   *
   * First checks the navigator registry for a pre-registered constructor.
   * If not found, falls back to dynamic import (for custom navigators).
   *
   * For reliable operation in test environments, call initializeNavigatorRegistry()
   * before using this method.
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

    // First, check the registry for a pre-registered constructor
    const RegisteredImpl = getRegisteredNavigator(implementingClass);
    if (RegisteredImpl) {
      logger.debug(`[ContentNavigator.create] Using registered navigator: ${implementingClass}`);
      return new RegisteredImpl(user, course, strategyData);
    }

    // Fall back to dynamic import for custom/unknown navigators
    logger.debug(
      `[ContentNavigator.create] Navigator not in registry, attempting dynamic import: ${implementingClass}`
    );

    let NavigatorImpl;

    // Try different extension variations
    const variations = ['.ts', '.js', ''];
    const dirs = ['filters', 'generators'];

    for (const ext of variations) {
      for (const dir of dirs) {
        const loadFrom = `./${dir}/${implementingClass}${ext}`;
        try {
          const module = await import(loadFrom);
          NavigatorImpl = module.default;
          break; // Break the loop if loading succeeds
        } catch (e) {
          // Continue to next variation if this one fails
          logger.debug(`Failed to load extension from ${loadFrom}:`, e);
        }
      }
    }

    if (!NavigatorImpl) {
      throw new Error(`Could not load navigator implementation for: ${implementingClass}`);
    }

    return new NavigatorImpl(user, course, strategyData);
  }

  /**
   * Get cards with suitability scores and provenance trails.
   *
   * **This is the PRIMARY API for navigation strategies.**
   *
   * Returns cards ranked by suitability score (0-1). Higher scores indicate
   * better candidates for presentation. Each card includes a provenance trail
   * documenting how strategies contributed to the final score.
   *
   * ## Implementation Required
   * All navigation strategies MUST override this method. The base class does
   * not provide a default implementation.
   *
   * ## For Generators
   * Override this method to generate candidates and compute scores based on
   * your strategy's logic (e.g., ELO proximity, review urgency). Create the
   * initial provenance entry with action='generated'.
   *
   * ## For Filters
   * Filters should implement the CardFilter interface instead and be composed
   * via Pipeline. Filters do not directly implement getWeightedCards().
   *
   * @param limit - Maximum cards to return
   * @returns Cards sorted by score descending, with provenance trails
   */
  async getWeightedCards(_limit: number): Promise<WeightedCard[]> {
    throw new Error(`${this.constructor.name} must implement getWeightedCards(). `);
  }
}
