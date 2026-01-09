/**
 * Strategy Templates - Common strategy configurations for testing.
 *
 * Pre-defined strategy configurations that can be used with CourseBuilder
 * or directly with TestCourseDB.
 */

import { StrategyDefinition } from './course-builder';

// ============================================================================
// GENERATOR STRATEGIES
// ============================================================================

/**
 * Default ELO-based generator strategy.
 * Selects cards close to the user's skill level.
 */
export const ELO_GENERATOR: StrategyDefinition = {
  name: 'elo-generator',
  implementingClass: 'elo',
  description: 'ELO-based card selection prioritizing skill-appropriate content',
};

/**
 * ELO generator with narrow target range (stricter difficulty matching).
 */
export const ELO_GENERATOR_NARROW: StrategyDefinition = {
  name: 'elo-generator-narrow',
  implementingClass: 'elo',
  description: 'ELO generator with narrow difficulty range',
  serializedData: JSON.stringify({ targetRange: 100 }),
};

/**
 * ELO generator with wide target range (more variety).
 */
export const ELO_GENERATOR_WIDE: StrategyDefinition = {
  name: 'elo-generator-wide',
  implementingClass: 'elo',
  description: 'ELO generator with wide difficulty range',
  serializedData: JSON.stringify({ targetRange: 400 }),
};

/**
 * Default SRS generator strategy.
 * Prioritizes cards due for review.
 */
export const SRS_GENERATOR: StrategyDefinition = {
  name: 'srs-generator',
  implementingClass: 'srs',
  description: 'Spaced repetition scheduling for review cards',
};

/**
 * SRS generator with aggressive overdue weighting.
 */
export const SRS_GENERATOR_AGGRESSIVE: StrategyDefinition = {
  name: 'srs-generator-aggressive',
  implementingClass: 'srs',
  description: 'SRS with high priority on overdue cards',
  serializedData: JSON.stringify({ overdueWeight: 2.0, intervalWeight: 1.0 }),
};

/**
 * Hardcoded card generator (uses a fixed set of cards).
 */
export function createHardcodedGenerator(
  name: string,
  cardIds: string[]
): StrategyDefinition {
  return {
    name,
    implementingClass: 'hardcoded',
    description: `Fixed card set: ${cardIds.length} cards`,
    serializedData: JSON.stringify({ cardIds }),
  };
}

// ============================================================================
// FILTER STRATEGIES
// ============================================================================

/**
 * Simple three-level hierarchy filter.
 */
export const HIERARCHY_THREE_LEVELS: StrategyDefinition = {
  name: 'hierarchy-3-level',
  implementingClass: 'hierarchyDefinition',
  description: 'Beginner → Intermediate → Advanced progression',
  serializedData: JSON.stringify({
    levels: ['beginner', 'intermediate', 'advanced'],
    unlockThreshold: 0.8,
  }),
};

/**
 * Five-level hierarchy for more granular progression.
 */
export const HIERARCHY_FIVE_LEVELS: StrategyDefinition = {
  name: 'hierarchy-5-level',
  implementingClass: 'hierarchyDefinition',
  description: 'Five-level progression system',
  serializedData: JSON.stringify({
    levels: ['novice', 'beginner', 'intermediate', 'advanced', 'expert'],
    unlockThreshold: 0.75,
  }),
};

/**
 * Create a custom hierarchy filter.
 */
export function createHierarchyFilter(
  name: string,
  levels: string[],
  unlockThreshold = 0.8
): StrategyDefinition {
  return {
    name,
    implementingClass: 'hierarchyDefinition',
    description: `Hierarchy: ${levels.join(' → ')}`,
    serializedData: JSON.stringify({ levels, unlockThreshold }),
  };
}

/**
 * Default ELO distance filter.
 * Penalizes cards far from user's current level.
 */
export const ELO_DISTANCE_FILTER: StrategyDefinition = {
  name: 'elo-distance-filter',
  implementingClass: 'eloDistanceFilter',
  description: 'Penalize cards far from user skill level',
};

/**
 * Interference filter with default settings.
 */
export const INTERFERENCE_FILTER: StrategyDefinition = {
  name: 'interference-filter',
  implementingClass: 'interferenceFilter',
  description: 'Reduce interference from similar cards',
};

/**
 * Create a custom interference filter.
 */
export function createInterferenceFilter(
  name: string,
  options: {
    similarityThreshold?: number;
    recentCardWindow?: number;
  }
): StrategyDefinition {
  return {
    name,
    implementingClass: 'interferenceFilter',
    description: `Interference filter (threshold: ${options.similarityThreshold ?? 'default'})`,
    serializedData: JSON.stringify(options),
  };
}

/**
 * Create a relative priority filter with tag weights.
 */
export function createRelativePriorityFilter(
  name: string,
  tagPriorities: Record<string, number>
): StrategyDefinition {
  const tagList = Object.entries(tagPriorities)
    .map(([tag, priority]) => `${tag}=${priority}`)
    .join(', ');

  return {
    name,
    implementingClass: 'relativePriority',
    description: `Tag priorities: ${tagList}`,
    serializedData: JSON.stringify({ tagPriorities }),
  };
}

// ============================================================================
// COMPOSITE STRATEGY SETS
// ============================================================================

/**
 * Default pipeline configuration.
 * Combines ELO and SRS generators with distance filtering.
 */
export const DEFAULT_PIPELINE_STRATEGIES: StrategyDefinition[] = [
  ELO_GENERATOR,
  SRS_GENERATOR,
  ELO_DISTANCE_FILTER,
];

/**
 * Beginner-friendly configuration.
 * Uses hierarchy to control progression.
 */
export const BEGINNER_FRIENDLY_STRATEGIES: StrategyDefinition[] = [
  ELO_GENERATOR_WIDE,
  SRS_GENERATOR,
  HIERARCHY_THREE_LEVELS,
];

/**
 * Strict progression configuration.
 * Narrow ELO range with hierarchy enforcement.
 */
export const STRICT_PROGRESSION_STRATEGIES: StrategyDefinition[] = [
  ELO_GENERATOR_NARROW,
  SRS_GENERATOR_AGGRESSIVE,
  HIERARCHY_FIVE_LEVELS,
  ELO_DISTANCE_FILTER,
];

// ============================================================================
// STRATEGY PRESETS FOR SPECIFIC TEST SCENARIOS
// ============================================================================

/**
 * Strategies for testing hierarchy unlock behavior.
 */
export function hierarchyTestStrategies(levels: string[]): StrategyDefinition[] {
  return [
    ELO_GENERATOR,
    createHierarchyFilter('test-hierarchy', levels, 0.8),
  ];
}

/**
 * Strategies for testing ELO selection behavior.
 */
export function eloTestStrategies(targetRange?: number): StrategyDefinition[] {
  if (targetRange !== undefined) {
    return [
      {
        name: 'test-elo',
        implementingClass: 'elo',
        description: `ELO test (range: ${targetRange})`,
        serializedData: JSON.stringify({ targetRange }),
      },
      ELO_DISTANCE_FILTER,
    ];
  }
  return [ELO_GENERATOR, ELO_DISTANCE_FILTER];
}

/**
 * Strategies for testing SRS scheduling behavior.
 */
export function srsTestStrategies(): StrategyDefinition[] {
  return [SRS_GENERATOR_AGGRESSIVE];
}

/**
 * Minimal strategy set for basic pipeline tests.
 */
export function minimalStrategies(): StrategyDefinition[] {
  return [ELO_GENERATOR];
}