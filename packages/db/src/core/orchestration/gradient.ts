import { UserOutcomeRecord } from '../types/userOutcome';
import { GradientObservation, GradientResult } from '../types/learningState';
import { logger } from '../../util/logger';

/**
 * Extract (deviation, outcome) observations for a specific strategy
 * from a collection of UserOutcomeRecords.
 *
 * @param outcomes - Collection of outcome records (from multiple users)
 * @param strategyId - The strategy to extract observations for
 * @returns Array of gradient observations
 */
export function aggregateOutcomesForGradient(
  outcomes: UserOutcomeRecord[],
  strategyId: string
): GradientObservation[] {
  const observations: GradientObservation[] = [];

  for (const outcome of outcomes) {
    // Skip if this outcome doesn't have a deviation for this strategy
    const deviation = outcome.deviations[strategyId];
    if (deviation === undefined) {
      continue;
    }

    observations.push({
      deviation,
      outcomeValue: outcome.outcomeValue,
      weight: 1.0,
    });
  }

  logger.debug(
    `[Orchestration] Aggregated ${observations.length} observations for strategy ${strategyId}`
  );

  return observations;
}

/**
 * Compute linear regression on (deviation, outcome) pairs.
 *
 * Uses ordinary least squares to find the best fit line:
 *   outcome = gradient * deviation + intercept
 *
 * The gradient tells us:
 * - Positive: users with higher deviation (higher weight) had better outcomes
 *             → we should increase the peak weight
 * - Negative: users with higher deviation (higher weight) had worse outcomes
 *             → we should decrease the peak weight
 * - Near zero: weight doesn't affect outcomes much
 *             → we're near optimal, increase confidence
 *
 * @param observations - Array of (deviation, outcome) pairs
 * @returns Regression result, or null if insufficient data
 */
export function computeStrategyGradient(
  observations: GradientObservation[]
): GradientResult | null {
  const n = observations.length;

  if (n < 3) {
    logger.debug(`[Orchestration] Insufficient observations for gradient (${n} < 3)`);
    return null;
  }

  // Compute means
  let sumX = 0;
  let sumY = 0;
  let sumW = 0;

  for (const obs of observations) {
    const w = obs.weight ?? 1.0;
    sumX += obs.deviation * w;
    sumY += obs.outcomeValue * w;
    sumW += w;
  }

  const meanX = sumX / sumW;
  const meanY = sumY / sumW;

  // Compute slope (gradient) and intercept using weighted least squares
  let numerator = 0;
  let denominator = 0;
  let ssTotal = 0;

  for (const obs of observations) {
    const w = obs.weight ?? 1.0;
    const dx = obs.deviation - meanX;
    const dy = obs.outcomeValue - meanY;

    numerator += w * dx * dy;
    denominator += w * dx * dx;
    ssTotal += w * dy * dy;
  }

  // Avoid division by zero if all deviations are the same
  if (denominator < 1e-10) {
    logger.debug(`[Orchestration] No variance in deviations, cannot compute gradient`);
    return {
      gradient: 0,
      intercept: meanY,
      rSquared: 0,
      sampleSize: n,
    };
  }

  const gradient = numerator / denominator;
  const intercept = meanY - gradient * meanX;

  // Compute R-squared
  let ssResidual = 0;
  for (const obs of observations) {
    const w = obs.weight ?? 1.0;
    const predicted = gradient * obs.deviation + intercept;
    const residual = obs.outcomeValue - predicted;
    ssResidual += w * residual * residual;
  }

  const rSquared = ssTotal > 1e-10 ? 1 - ssResidual / ssTotal : 0;

  logger.debug(
    `[Orchestration] Computed gradient: ${gradient.toFixed(4)}, ` +
      `intercept: ${intercept.toFixed(4)}, R²: ${rSquared.toFixed(4)}, n=${n}`
  );

  return {
    gradient,
    intercept,
    rSquared: Math.max(0, Math.min(1, rSquared)), // Clamp to [0,1]
    sampleSize: n,
  };
}
