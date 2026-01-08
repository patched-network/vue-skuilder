import { LearnableWeight, DEFAULT_LEARNABLE_WEIGHT } from '../types/contentNavigationStrategy';
import { StrategyLearningState, GradientResult } from '../types/learningState';
import { DocType } from '../types/types-legacy';
import { logger } from '../../util/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum observations required before adjusting weight */
const MIN_OBSERVATIONS_FOR_UPDATE = 10;

/** How much to adjust weight per gradient unit */
const LEARNING_RATE = 0.1;

/** Maximum weight adjustment per update cycle */
const MAX_WEIGHT_DELTA = 0.3;

/** R-squared threshold below which we consider gradient unreliable */
const MIN_R_SQUARED_FOR_GRADIENT = 0.05;

/** Gradient magnitude below which we consider it "flat" (near optimal) */
const FLAT_GRADIENT_THRESHOLD = 0.02;

/** Maximum history entries to retain */
const MAX_HISTORY_LENGTH = 100;

// ============================================================================
// WEIGHT UPDATE
// ============================================================================

/**
 * Compute updated weight based on gradient result.
 *
 * The update logic:
 * - Positive gradient: users with higher weight did better → increase weight
 * - Negative gradient: users with higher weight did worse → decrease weight
 * - Flat gradient: weight doesn't affect outcome → increase confidence
 *
 * @param current - Current learnable weight
 * @param gradient - Computed gradient result
 * @returns Updated learnable weight
 */
export function updateStrategyWeight(
  current: LearnableWeight,
  gradient: GradientResult
): LearnableWeight {
  // Not enough data to make reliable updates
  if (gradient.sampleSize < MIN_OBSERVATIONS_FOR_UPDATE) {
    logger.debug(
      `[Orchestration] Insufficient samples (${gradient.sampleSize} < ${MIN_OBSERVATIONS_FOR_UPDATE}), ` +
        `keeping current weight`
    );
    return {
      ...current,
      sampleSize: current.sampleSize + gradient.sampleSize,
    };
  }

  // Check if gradient is reliable (R² threshold)
  const isReliable = gradient.rSquared >= MIN_R_SQUARED_FOR_GRADIENT;
  const isFlat = Math.abs(gradient.gradient) < FLAT_GRADIENT_THRESHOLD;

  let newWeight = current.weight;
  let newConfidence = current.confidence;

  if (!isReliable || isFlat) {
    // Gradient is unreliable or flat - we're likely near optimal
    // Increase confidence (narrow the exploration spread)
    const confidenceGain = 0.05 * (1 - current.confidence);
    newConfidence = Math.min(1.0, current.confidence + confidenceGain);

    logger.debug(
      `[Orchestration] Flat/unreliable gradient (|g|=${Math.abs(gradient.gradient).toFixed(4)}, ` +
        `R²=${gradient.rSquared.toFixed(4)}). Increasing confidence: ${current.confidence.toFixed(3)} → ${newConfidence.toFixed(3)}`
    );
  } else {
    // Reliable gradient - adjust weight in gradient direction
    // Scale by learning rate and clamp to max delta
    let delta = gradient.gradient * LEARNING_RATE;
    delta = Math.max(-MAX_WEIGHT_DELTA, Math.min(MAX_WEIGHT_DELTA, delta));

    newWeight = current.weight + delta;

    // Clamp weight to reasonable bounds
    newWeight = Math.max(0.1, Math.min(3.0, newWeight));

    // Slight confidence increase for having made an observation
    const confidenceGain = 0.02 * (1 - current.confidence);
    newConfidence = Math.min(1.0, current.confidence + confidenceGain);

    logger.debug(
      `[Orchestration] Adjusting weight: ${current.weight.toFixed(3)} → ${newWeight.toFixed(3)} ` +
        `(gradient=${gradient.gradient.toFixed(4)}, delta=${delta.toFixed(4)})`
    );
  }

  return {
    weight: newWeight,
    confidence: newConfidence,
    sampleSize: current.sampleSize + gradient.sampleSize,
  };
}

// ============================================================================
// LEARNING STATE MANAGEMENT
// ============================================================================

/**
 * Create or update a StrategyLearningState document.
 *
 * @param courseId - Course ID
 * @param strategyId - Strategy ID
 * @param currentWeight - Current learned weight
 * @param gradient - Gradient result from recent computation
 * @param existing - Existing learning state (if any)
 * @returns Updated learning state document
 */
export function updateLearningState(
  courseId: string,
  strategyId: string,
  currentWeight: LearnableWeight,
  gradient: GradientResult,
  existing?: StrategyLearningState
): StrategyLearningState {
  const now = new Date().toISOString();
  const id = `STRATEGY_LEARNING_STATE::${courseId}::${strategyId}`;

  // Build history entry
  const historyEntry = {
    timestamp: now,
    weight: currentWeight.weight,
    confidence: currentWeight.confidence,
    gradient: gradient.gradient,
  };

  // Append to existing history or start fresh
  let history = existing?.history ?? [];
  history = [...history, historyEntry];

  // Trim history if too long
  if (history.length > MAX_HISTORY_LENGTH) {
    history = history.slice(history.length - MAX_HISTORY_LENGTH);
  }

  const state: StrategyLearningState = {
    _id: id,
    _rev: existing?._rev,
    docType: DocType.STRATEGY_LEARNING_STATE,
    courseId,
    strategyId,
    currentWeight,
    regression: {
      gradient: gradient.gradient,
      intercept: gradient.intercept,
      rSquared: gradient.rSquared,
      sampleSize: gradient.sampleSize,
      computedAt: now,
    },
    history,
    updatedAt: now,
  };

  return state;
}

// ============================================================================
// PERIOD UPDATE ORCHESTRATOR
// ============================================================================

/**
 * Input data for running a period update on a single strategy.
 */
export interface PeriodUpdateInput {
  courseId: string;
  strategyId: string;
  currentWeight: LearnableWeight;
  gradient: GradientResult;
  existingState?: StrategyLearningState;
}

/**
 * Result of a period update for a single strategy.
 */
export interface PeriodUpdateResult {
  strategyId: string;
  previousWeight: LearnableWeight;
  newWeight: LearnableWeight;
  gradient: GradientResult;
  learningState: StrategyLearningState;
  updated: boolean;
}

/**
 * Run a period update for a single strategy.
 *
 * This function:
 * 1. Takes the computed gradient
 * 2. Computes the new weight
 * 3. Generates the updated learning state
 *
 * Note: Actual persistence (updating strategy doc, saving learning state)
 * must be done by the caller with appropriate DB access.
 *
 * @param input - Update input data
 * @returns Update result with new weight and learning state
 */
export function runPeriodUpdate(input: PeriodUpdateInput): PeriodUpdateResult {
  const { courseId, strategyId, currentWeight, gradient, existingState } = input;

  logger.info(
    `[Orchestration] Running period update for strategy ${strategyId} ` +
      `(${gradient.sampleSize} observations)`
  );

  // Compute new weight
  const newWeight = updateStrategyWeight(currentWeight, gradient);
  const updated = newWeight.weight !== currentWeight.weight;

  // Generate learning state
  const learningState = updateLearningState(
    courseId,
    strategyId,
    newWeight,
    gradient,
    existingState
  );

  logger.info(
    `[Orchestration] Period update complete for ${strategyId}: ` +
      `weight ${currentWeight.weight.toFixed(3)} → ${newWeight.weight.toFixed(3)}, ` +
      `confidence ${currentWeight.confidence.toFixed(3)} → ${newWeight.confidence.toFixed(3)}`
  );

  return {
    strategyId,
    previousWeight: currentWeight,
    newWeight,
    gradient,
    learningState,
    updated,
  };
}

/**
 * Create a default LearnableWeight for strategies that don't have one.
 */
export function getDefaultLearnableWeight(): LearnableWeight {
  return { ...DEFAULT_LEARNABLE_WEIGHT };
}
