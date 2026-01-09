/**
 * Test fixtures for e2e-pipeline tests.
 *
 * Provides course builders, strategy templates, and card templates
 * for constructing test scenarios.
 */

// Course builder fluent API
export {
  CourseBuilder,
  CardDefinition,
  StrategyDefinition,
  CourseBuilderResult,
  createCourseBuilder,
} from './course-builder';

// Strategy templates
export {
  // Generators
  ELO_GENERATOR,
  ELO_GENERATOR_NARROW,
  ELO_GENERATOR_WIDE,
  SRS_GENERATOR,
  SRS_GENERATOR_AGGRESSIVE,
  createHardcodedGenerator,
  // Filters
  HIERARCHY_THREE_LEVELS,
  HIERARCHY_FIVE_LEVELS,
  ELO_DISTANCE_FILTER,
  INTERFERENCE_FILTER,
  createHierarchyFilter,
  createInterferenceFilter,
  createRelativePriorityFilter,
  // Composite sets
  DEFAULT_PIPELINE_STRATEGIES,
  BEGINNER_FRIENDLY_STRATEGIES,
  STRICT_PROGRESSION_STRATEGIES,
  // Test presets
  hierarchyTestStrategies,
  eloTestStrategies,
  srsTestStrategies,
  minimalStrategies,
} from './strategy-templates';

// Card templates
export {
  // Basic card creators
  fillInCard,
  mathFillInCard,
  vocabFillInCard,
  multipleChoiceCard,
  trueFalseCard,
  flashcard,
  translationCard,
  // Card set generators
  eloGradientCards,
  hierarchyCards,
  interferenceCards,
  taggedCards,
  minimalTestCards,
  comprehensiveTestDeck,
} from './card-templates';