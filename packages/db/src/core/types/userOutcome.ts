import { DocType } from './types-legacy';

/**
 * Record of a user's learning outcome over a specific period.
 *
 * Used by the evolutionary orchestration system to correlate strategy
 * deviations with learning success.
 * 
 * Stored in the UserDB.
 */
export interface UserOutcomeRecord {
  /** 
   * Unique ID: "USER_OUTCOME::{courseId}::{userId}::{timestamp}" 
   * Timestamp corresponds to periodEnd.
   */
  _id: string;
  
  docType: DocType.USER_OUTCOME;

  courseId: string;
  userId: string;

  /** Start of the measurement period (ISO timestamp) */
  periodStart: string;
  /** End of the measurement period (ISO timestamp) */
  periodEnd: string;

  /**
   * The computed signal value (e.g., 0.85 for 85% accuracy).
   * This is the 'Y' in the regression analysis.
   * 
   * Higher values indicate better learning outcomes.
   */
  outcomeValue: number;

  /**
   * Snapshot of active deviations during this period.
   * Maps strategyId -> deviation value used [-1.0, 1.0].
   * This provides the 'X' values for regression analysis.
   */
  deviations: Record<string, number>;

  metadata: {
    sessionsCount: number;
    cardsSeen: number;
    eloStart: number;
    eloEnd: number;
    /** The algorithm used to compute outcomeValue (e.g. "accuracy_in_zone") */
    signalType: string;
  };
}