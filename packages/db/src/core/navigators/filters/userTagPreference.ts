import type { ScheduledCard } from '../../types/user';
import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import type { ContentNavigationStrategyData } from '../../types/contentNavigationStrategy';
import type { StudySessionReviewItem, StudySessionNewItem } from '../..';
import type { CardFilter, FilterContext } from './types';

// ============================================================================
// USER TAG PREFERENCE FILTER
// ============================================================================
//
// Allows users to personalize their learning experience by specifying:
// - Tags to boost/penalize (score multiplied by boost factor)
//
// User preferences are stored in STRATEGY_STATE documents in the user's
// database, enabling persistence across sessions and sync across devices.
//
// Use cases:
// - Goal-based learning: "I want to learn piano by ear, skip sight-reading"
// - Selective focus: "I only want to practice chess endgames"
// - Accessibility: "Skip text-heavy cards, prefer visual content"
// - Difficulty customization: "Skip beginner content I already know"
//
// ============================================================================

/**
 * User's tag preference state, stored in STRATEGY_STATE document.
 *
 * This interface defines what gets persisted to the user's database.
 * UI components write to this structure, and the filter reads from it.
 *
 * ## Preferences vs Goals
 *
 * Preferences are **path constraints** — they affect HOW the user learns,
 * not WHAT they're trying to learn. Examples:
 * - "Skip text-heavy cards" (accessibility)
 * - "Prefer visual content"
 *
 * For **goal-based** filtering (defining WHAT to learn), see the separate
 * UserGoalNavigator (stub). Goals affect progress tracking and completion
 * criteria; preferences only affect card selection.
 *
 * ## Slider Semantics
 *
 * Each tag maps to a multiplier value in the `boost` record:
 * - `0` = banish/exclude (card score = 0)
 * - `0.5` = penalize by 50%
 * - `1.0` = neutral/no effect (default when tag added)
 * - `2.0` = 2x preference boost
 * - Higher values = stronger preference
 *
 * If multiple tags on a card have preferences, the maximum multiplier wins.
 */
export interface UserTagPreferenceState {
  /**
   * Tag-specific multipliers.
   * Maps tag name to score multiplier (0 = exclude, 1 = neutral, >1 = boost).
   */
  boost: Record<string, number>;

  /**
   * ISO timestamp of last update.
   * Use `moment.utc(updatedAt)` to parse into a Moment object.
   */
  updatedAt: string;
}

/**
 * A filter that applies user-configured tag preferences.
 *
 * Reads preferences from STRATEGY_STATE document in user's database.
 * If no preferences exist, passes through unchanged (no-op).
 *
 * Implements CardFilter for use in Pipeline architecture.
 * Also extends ContentNavigator for compatibility with dynamic loading.
 */
export default class UserTagPreferenceFilter extends ContentNavigator implements CardFilter {
  private _strategyData: ContentNavigationStrategyData;

  /** Human-readable name for CardFilter interface */
  name: string;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super(user, course, strategyData);
    this._strategyData = strategyData;
    this.name = strategyData.name || 'User Tag Preferences';
  }

  /**
   * Compute multiplier for a card based on its tags and user preferences.
   * Returns the maximum multiplier among all matching tags, or 1.0 if no matches.
   */
  private computeMultiplier(cardTags: string[], boostMap: Record<string, number>): number {
    const multipliers = cardTags
      .map((tag) => boostMap[tag])
      .filter((val) => val !== undefined);

    if (multipliers.length === 0) {
      return 1.0;
    }

    // Use max multiplier among matching tags
    return Math.max(...multipliers);
  }

  /**
   * Build human-readable reason for the filter's decision.
   */
  private buildReason(
    cardTags: string[],
    boostMap: Record<string, number>,
    multiplier: number
  ): string {
    // Find which tag(s) contributed to the multiplier
    const matchingTags = cardTags.filter((tag) => boostMap[tag] === multiplier);

    if (multiplier === 0) {
      return `Excluded by user preference: ${matchingTags.join(', ')} (${multiplier}x)`;
    }

    if (multiplier < 1.0) {
      return `Penalized by user preference: ${matchingTags.join(', ')} (${multiplier.toFixed(2)}x)`;
    }

    if (multiplier > 1.0) {
      return `Boosted by user preference: ${matchingTags.join(', ')} (${multiplier.toFixed(2)}x)`;
    }

    return 'No matching user preferences';
  }

  /**
   * CardFilter.transform implementation.
   *
   * Apply user tag preferences:
   * 1. Read preferences from strategy state
   * 2. If no preferences, pass through unchanged
   * 3. For each card:
   *    - Look up tag in boost record
   *    - If tag found: apply multiplier (0 = exclude, 1 = neutral, >1 = boost)
   *    - If multiple tags match: use max multiplier
   *    - Append provenance with clear reason
   */
  async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    // Read user preferences from strategy state
    const prefs = await this.getStrategyState<UserTagPreferenceState>();

    // No preferences configured → pass through unchanged
    if (!prefs || Object.keys(prefs.boost).length === 0) {
      return cards.map((card) => ({
        ...card,
        provenance: [
          ...card.provenance,
          {
            strategy: 'userTagPreference',
            strategyName: this.strategyName || this.name,
            strategyId: this.strategyId || this._strategyData._id,
            action: 'passed' as const,
            score: card.score,
            reason: 'No user tag preferences configured',
          },
        ],
      }));
    }

    // Process each card
    const adjusted: WeightedCard[] = await Promise.all(
      cards.map(async (card) => {
        const cardTags = card.tags ?? [];

        // Compute multiplier based on card tags and user preferences
        const multiplier = this.computeMultiplier(cardTags, prefs.boost);
        const finalScore = Math.min(1, card.score * multiplier);

        // Determine action for provenance
        let action: 'passed' | 'boosted' | 'penalized';
        if (multiplier === 0 || multiplier < 1.0) {
          action = 'penalized';
        } else if (multiplier > 1.0) {
          action = 'boosted';
        } else {
          action = 'passed';
        }

        return {
          ...card,
          score: finalScore,
          provenance: [
            ...card.provenance,
            {
              strategy: 'userTagPreference',
              strategyName: this.strategyName || this.name,
              strategyId: this.strategyId || this._strategyData._id,
              action,
              score: finalScore,
              reason: this.buildReason(cardTags, prefs.boost, multiplier),
            },
          ],
        };
      })
    );

    return adjusted;
  }

  /**
   * Legacy getWeightedCards - throws as filters should not be used as generators.
   */
  async getWeightedCards(_limit: number): Promise<WeightedCard[]> {
    throw new Error(
      'UserTagPreferenceFilter is a filter and should not be used as a generator. ' +
        'Use Pipeline with a generator and this filter via transform().'
    );
  }

  // Legacy methods - stub implementations since filters don't generate cards

  async getNewCards(_n?: number): Promise<StudySessionNewItem[]> {
    return [];
  }

  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    return [];
  }
}
