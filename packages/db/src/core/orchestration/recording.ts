import { OrchestrationContext } from './index';
import { computeOutcomeSignal, SignalConfig } from './signal';
import { UserOutcomeRecord } from '../types/userOutcome';
import { DocType, QuestionRecord } from '../types/types-legacy';
import { logger } from '../../util/logger';

/**
 * Records a learning outcome for a specific period of time.
 *
 * This function:
 * 1. Computes a scalar "success" signal from the provided question records
 * 2. Re-computes the deviations that were active for this user/course
 * 3. Persists a UserOutcomeRecord to the user's database
 *
 * This record is later used by the optimization job to correlate
 * deviations with outcomes (Evolutionary Orchestration).
 *
 * @param context - Orchestration context (user, course, etc.)
 * @param periodStart - ISO timestamp of period start
 * @param periodEnd - ISO timestamp of period end (now)
 * @param records - Question records generated during this period
 * @param activeStrategyIds - IDs of strategies active in this course
 * @param eloStart - User's ELO at start of period (optional)
 * @param eloEnd - User's ELO at end of period (optional)
 * @param config - Optional configuration for signal computation
 */
export async function recordUserOutcome(
  context: OrchestrationContext,
  periodStart: string,
  periodEnd: string,
  records: QuestionRecord[],
  activeStrategyIds: string[],
  eloStart: number = 0,
  eloEnd: number = 0,
  config?: SignalConfig
): Promise<void> {
  const { user, course, userId } = context;
  const courseId = course.getCourseID();

  // 1. Compute Signal
  // If we have no records, we can't determine an outcome.
  const outcomeValue = computeOutcomeSignal(records, config);

  if (outcomeValue === null) {
    logger.debug(
      `[Orchestration] No outcome signal computed for ${userId} (insufficient data). Skipping record.`
    );
    return;
  }

  // 2. Capture Deviations
  // We re-compute the deterministic deviations for all active strategies.
  // This tells the learning algorithm "what parameter adjustments were active
  // when this outcome was achieved".
  const deviations: Record<string, number> = {};
  for (const strategyId of activeStrategyIds) {
    deviations[strategyId] = context.getDeviation(strategyId);
  }

  // 3. Construct Record
  // ID format: USER_OUTCOME::{courseId}::{userId}::{periodEnd}
  // This ensures uniqueness per user/course/time-period.
  const id = `USER_OUTCOME::${courseId}::${userId}::${periodEnd}`;

  const record: UserOutcomeRecord = {
    _id: id,
    docType: DocType.USER_OUTCOME,
    courseId,
    userId,
    periodStart,
    periodEnd,
    outcomeValue,
    deviations,
    metadata: {
      sessionsCount: 1, // Assumes recording is triggered per-session currently
      cardsSeen: records.length,
      eloStart,
      eloEnd,
      signalType: 'accuracy_in_zone',
    },
  };

  // 4. Persist
  try {
    await user.putUserOutcome(record);
    logger.debug(
      `[Orchestration] Recorded outcome ${outcomeValue.toFixed(3)} for ${userId} (doc: ${id})`
    );
  } catch (e) {
    logger.error(`[Orchestration] Failed to record outcome: ${e}`);
  }
}