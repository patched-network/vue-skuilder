import { DocType } from './types-legacy';
import { LearnableWeight } from './contentNavigationStrategy';

/**
 * Snapshot of the learning state for a strategy.
 *
 * Stored in the CourseDB for observability and debugging.
 * Updated periodically by the gradient learning system.
 */
export interface StrategyLearningState {
  /**
   * Unique ID: "STRATEGY_LEARNING_STATE::{courseId}::{strategyId}"
   */
  _id: string;

  /** Allow CouchDB to manage revisions */
  _rev?: string;

  docType: DocType.STRATEGY_LEARNING_STATE;

  courseId: string;
  strategyId: string;

  /** Current learned weight (mirrors the strategy doc, for convenience) */
  currentWeight: LearnableWeight;

  /** Most recent regression statistics */
  regression: {
    /** Slope of the linear regression (deviation vs outcome) */
    gradient: number;
    /** Y-intercept of the regression line */
    intercept: number;
    /** R-squared value (0-1), measure of fit quality */
    rSquared: number;
    /** Number of observations used in this regression */
    sampleSize: number;
    /** ISO timestamp of when this regression was computed */
    computedAt: string;
  };

  /** Historical weight snapshots for visualization */
  history: Array<{
    timestamp: string;
    weight: number;
    confidence: number;
    gradient: number;
  }>;

  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Data point for gradient computation: (deviation, outcome) pair.
 */
export interface GradientObservation {
  /** User's deviation for this strategy [-1, 1] */
  deviation: number;
  /** User's outcome value [0, 1] */
  outcomeValue: number;
  /** Optional: weight for this observation (default 1.0) */
  weight?: number;
}

/**
 * Result of linear regression on (deviation, outcome) pairs.
 */
export interface GradientResult {
  /** Slope: positive = higher deviation correlates with better outcomes */
  gradient: number;
  /** Y-intercept */
  intercept: number;
  /** R-squared: 0-1, how well the line fits */
  rSquared: number;
  /** Number of observations */
  sampleSize: number;
}
