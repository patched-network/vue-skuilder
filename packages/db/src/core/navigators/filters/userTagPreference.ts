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
// - Tags to exclude (score = 0)
// - Tags to include/boost (score multiplied by boost factor)
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
 */
export interface UserTagPreferenceState {
  /**
   * Tags to prefer (boost score).
   * Cards with any of these tags get their score multiplied by the boost factor.
   * Use for preferences, not goal-based focus.
   */
  prefer: string[];

  /**
   * Tags to avoid (hard filter).
   * Cards with any of these tags get score = 0.
   * Use for accessibility or presentation preferences, not goal-based exclusion.
   */
  avoid: string[];

  /**
   * Tag-specific boost multipliers.
   * If a tag appears here, its value is used as the multiplier.
   * If a tag is in `prefer` but not here, DEFAULT_BOOST is used.
   */
  boost: Record<string, number>;

  /**
   * ISO timestamp of last update.
   * Use `moment.utc(updatedAt)` to parse into a Moment object.
   */
  updatedAt: string;
}

/**
 * Default boost multiplier for included tags without explicit boost value.
 */
const DEFAULT_BOOST = 1.5;

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
   * Get tags for a single card.
   */
  private async getCardTags(cardId: string, course: CourseDBInterface): Promise<string[]> {
    try {
      const tagResponse = await course.getAppliedTags(cardId);
      return tagResponse.rows.map((r) => r.value?.name || r.key).filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Check if any card tags are in the avoid list.
   */
  private hasAvoidedTag(cardTags: string[], avoidList: string[]): boolean {
    const avoidSet = new Set(avoidList);
    return cardTags.some((tag) => avoidSet.has(tag));
  }

  /**
   * Compute boost multiplier for a card based on its tags.
   * Returns 1.0 if no preferred tags match.
   */
  private computeBoost(
    cardTags: string[],
    preferList: string[],
    boostMap: Record<string, number>
  ): number {
    const preferSet = new Set(preferList);
    const matchingTags = cardTags.filter((tag) => preferSet.has(tag));

    if (matchingTags.length === 0) {
      return 1.0;
    }

    // Use max boost among matching tags
    const boosts = matchingTags.map((tag) => boostMap[tag] ?? DEFAULT_BOOST);
    return Math.max(...boosts);
  }

  /**
   * Build human-readable reason for the filter's decision.
   */
  private buildReason(
    cardTags: string[],
    prefs: UserTagPreferenceState,
    action: 'passed' | 'boosted' | 'penalized',
    multiplier: number,
    finalScore: number
  ): string {
    if (action === 'penalized' && finalScore === 0) {
      const avoidedTags = cardTags.filter((t) => prefs.avoid.includes(t));
      return `Avoided by user preference: ${avoidedTags.join(', ')}`;
    }

    if (action === 'boosted') {
      const preferredTags = cardTags.filter((t) => prefs.prefer.includes(t));
      return `Preferred by user: ${preferredTags.join(', ')} (${multiplier.toFixed(2)}x)`;
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
   *    - If any excluded tag present → score = 0
   *    - If any included tag present → apply boost multiplier
   *    - Otherwise → pass through unchanged
   */
  async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    // Read user preferences from strategy state
    const prefs = await this.getStrategyState<UserTagPreferenceState>();

    // No preferences configured → pass through unchanged
    if (!prefs || (prefs.prefer.length === 0 && prefs.avoid.length === 0)) {
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
        const cardTags = await this.getCardTags(card.cardId, context.course);

        // Check avoidances first (hard filter)
        if (this.hasAvoidedTag(cardTags, prefs.avoid)) {
          return {
            ...card,
            score: 0,
            provenance: [
              ...card.provenance,
              {
                strategy: 'userTagPreference',
                strategyName: this.strategyName || this.name,
                strategyId: this.strategyId || this._strategyData._id,
                action: 'penalized' as const,
                score: 0,
                reason: this.buildReason(cardTags, prefs, 'penalized', 0, 0),
              },
            ],
          };
        }

        // Compute boost for preferred tags
        const multiplier = this.computeBoost(cardTags, prefs.prefer, prefs.boost);
        const finalScore = Math.min(1, card.score * multiplier);
        const action = multiplier > 1.0 ? 'boosted' : 'passed';

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
              reason: this.buildReason(cardTags, prefs, action, multiplier, finalScore),
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
