import { DocType, DocTypePrefixes } from './types-legacy';

/**
 * Template literal type for strategy state document IDs.
 *
 * Format: `STRATEGY_STATE-{courseId}-{strategyKey}`
 */
export type StrategyStateId =
  `${(typeof DocTypePrefixes)[DocType.STRATEGY_STATE]}::${string}::${string}`;

/**
 * Document storing strategy-specific state in the user database.
 *
 * Each strategy can persist its own state (user preferences, learned patterns,
 * temporal tracking, etc.) using this document type. The state is scoped to
 * a (user, course, strategy) tuple.
 *
 * ## Use Cases
 *
 * 1. **Explicit user preferences**: User configures tag filters, difficulty
 *    preferences, or learning goals. UI writes to strategy state.
 *
 * 2. **Learned/temporal state**: Strategy tracks patterns over time, e.g.,
 *    "when did I last introduce confusable concepts together?"
 *
 * 3. **Adaptive personalization**: Strategy infers user preferences from
 *    behavior and stores them for future sessions.
 *
 * ## Storage Location
 *
 * These documents live in the **user database**, not the course database.
 * They sync with the user's data across devices.
 *
 * ## Document ID Format
 *
 * `STRATEGY_STATE::{courseId}::{strategyKey}`
 *
 * Example: `STRATEGY_STATE::piano-basics::UserTagPreferenceFilter`
 *
 * @template T - The shape of the strategy-specific data payload
 */
export interface StrategyStateDoc<T = unknown> {
  _id: StrategyStateId;
  _rev?: string;
  docType: DocType.STRATEGY_STATE;

  /**
   * The course this state applies to.
   */
  courseId: string;

  /**
   * Unique key identifying the strategy instance.
   * Typically the strategy class name (e.g., "UserTagPreferenceFilter",
   * "InterferenceMitigatorNavigator").
   *
   * If a course has multiple instances of the same strategy type with
   * different configurations, use a more specific key.
   */
  strategyKey: string;

  /**
   * Strategy-specific data payload.
   * Each strategy defines its own schema for this field.
   */
  data: T;

  /**
   * ISO timestamp of last update.
   * Use `moment.utc(updatedAt)` to parse into a Moment object.
   */
  updatedAt: string;
}

/**
 * Build the document ID for a strategy state document.
 *
 * @param courseId - The course ID
 * @param strategyKey - The strategy key (typically class name)
 * @returns The document ID in format `STRATEGY_STATE::{courseId}::{strategyKey}`
 */
export function buildStrategyStateId(courseId: string, strategyKey: string): StrategyStateId {
  return `STRATEGY_STATE::${courseId}::${strategyKey}`;
}
