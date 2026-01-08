import { DocType, SkuilderCourseData } from './types-legacy';
import type { DocTypePrefixes } from './types-legacy';

/**
 * Configuration for an evolutionarily-weighted strategy.
 *
 * This structure tracks the "learned" weight of a strategy, representing the
 * system's confidence in its utility.
 *
 * - weight: The best-known multiplier (peak of the bell curve)
 * - confidence: How certain we are (inverse of variance / spread)
 * - sampleSize: How many data points informed this weight
 */
export interface LearnableWeight {
  /** The current best estimate of optimal weight (multiplier) */
  weight: number;
  /** Confidence in this weight (0-1). Higher = narrower exploration spread. */
  confidence: number;
  /** Number of outcome observations that contributed to this weight */
  sampleSize: number;
}

export const DEFAULT_LEARNABLE_WEIGHT: LearnableWeight = {
  weight: 1.0,
  confidence: 0.1, // Low confidence initially = wide exploration
  sampleSize: 0,
};

/**
 *
 */
export interface ContentNavigationStrategyData extends SkuilderCourseData {
  _id: `${typeof DocTypePrefixes[DocType.NAVIGATION_STRATEGY]}-${string}`;
  docType: DocType.NAVIGATION_STRATEGY;
  name: string;
  description: string;
  /**
   The name of the class that implements the navigation strategy at runtime.
   */
  implementingClass: string;

  /**
   A representation of the strategy's parameterization - to be deserialized
   by the implementing class's constructor at runtime.
  */
  serializedData: string;

  /**
   * Evolutionary weighting configuration.
   * If present, the strategy's influence is scaled by this weight.
   * If omitted, weight defaults to 1.0.
   */
  learnable?: LearnableWeight;

  /**
   * If true, the weight is applied exactly as configured, without
   * per-user deviation. Used for manual tuning or A/B testing.
   */
  staticWeight?: boolean;
}
