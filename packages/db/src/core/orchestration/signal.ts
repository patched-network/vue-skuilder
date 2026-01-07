import { QuestionRecord } from '../types/types-legacy';

export interface SignalConfig {
  /** Target accuracy for "in the zone" learning (default: 0.85) */
  targetAccuracy?: number;
  /** Width of the peak plateau (default: 0.05) */
  tolerance?: number;
}

/**
 * Computes a scalar signal (0-1) representing the quality of the learning outcome.
 *
 * Current implementation focuses on "accuracy within Zone of Proximal Development".
 * Future versions should include ELO gain rate.
 *
 * @param records - List of question attempts in the period
 * @param config - Configuration for the signal function
 * @returns Score 0.0-1.0, or null if insufficient data
 */
export function computeOutcomeSignal(
  records: QuestionRecord[],
  config: SignalConfig = {}
): number | null {
  if (!records || records.length === 0) {
    return null;
  }

  const target = config.targetAccuracy ?? 0.85;
  const tolerance = config.tolerance ?? 0.05;

  let correct = 0;
  for (const r of records) {
    if (r.isCorrect) correct++;
  }

  const accuracy = correct / records.length;

  return scoreAccuracyInZone(accuracy, target, tolerance);
}

/**
 * Scores an accuracy value based on how close it is to the target "sweet spot".
 *
 * The function defines a plateau of width (2 * tolerance) around the target
 * where score is 1.0. Outside this plateau, it falls off linearly.
 *
 * @param accuracy - Observed accuracy (0-1)
 * @param target - Target accuracy (e.g. 0.85)
 * @param tolerance - +/- range allowed for max score
 */
export function scoreAccuracyInZone(accuracy: number, target: number, tolerance: number): number {
  const dist = Math.abs(accuracy - target);

  // Inside the sweet spot
  if (dist <= tolerance) {
    return 1.0;
  }

  // Outside, fall off.
  // We apply a linear penalty for deviation from the tolerance edge.
  const excess = dist - tolerance;
  const slope = 2.5; // Falloff rate (0.4 deviation = 0 score)

  return Math.max(0, 1.0 - excess * slope);
}