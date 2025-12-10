import type { CourseDBInterface } from '../interfaces/courseDB';
import type { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator } from './index';
import type { WeightedCard } from './index';
import type { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import type { CardFilter, FilterContext } from './filters/types';

/**
 * Configuration for the RelativePriority strategy.
 *
 * Course authors define priority weights for tags, allowing the system
 * to prefer high-utility content (common, well-behaved patterns) over
 * lower-utility content (rare, irregular patterns).
 *
 * Example use case: In phonics, prefer teaching 's' (common, consistent)
 * before 'x' or 'z' (rare, sometimes irregular).
 */
export interface RelativePriorityConfig {
  /**
   * Map of tag ID to priority weight (0-1).
   *
   * 1.0 = highest priority (present first)
   * 0.5 = neutral
   * 0.0 = lowest priority (defer until later)
   *
   * Example:
   * {
   *   "letter-s": 0.95,
   *   "letter-t": 0.90,
   *   "letter-x": 0.10,
   *   "letter-z": 0.05
   * }
   */
  tagPriorities: { [tagId: string]: number };

  /**
   * Priority for tags not explicitly listed (default: 0.5).
   * 0.5 means unlisted tags have neutral effect on scoring.
   */
  defaultPriority?: number;

  /**
   * How to combine priorities when a card has multiple tags.
   *
   * - 'max': Use the highest priority among the card's tags (default)
   * - 'average': Average all tag priorities
   * - 'min': Use the lowest priority (conservative)
   */
  combineMode?: 'max' | 'average' | 'min';

  /**
   * How strongly priority influences the final score (0-1, default: 0.5).
   *
   * At 0.0: Priority has no effect (pure delegate scoring)
   * At 0.5: Priority can boost/reduce scores by up to 25%
   * At 1.0: Priority can boost/reduce scores by up to 50%
   *
   * The boost factor formula: 1 + (priority - 0.5) * priorityInfluence
   * - Priority 1.0 with influence 0.5 → boost of 1.25
   * - Priority 0.5 with influence 0.5 → boost of 1.00 (neutral)
   * - Priority 0.0 with influence 0.5 → boost of 0.75
   */
  priorityInfluence?: number;
}

const DEFAULT_PRIORITY = 0.5;
const DEFAULT_PRIORITY_INFLUENCE = 0.5;
const DEFAULT_COMBINE_MODE: 'max' | 'average' | 'min' = 'max';

/**
 * A filter strategy that boosts scores for high-utility content.
 *
 * Course authors assign priority weights to tags. Cards with high-priority
 * tags get boosted scores, making them more likely to be presented first.
 * This allows teaching the most useful, well-behaved concepts before
 * moving on to rarer or more irregular ones.
 *
 * Example: When teaching phonics, prioritize common letters (s, t, a) over
 * rare ones (x, z, q) by assigning higher priority weights to common letters.
 *
 * Implements CardFilter for use in Pipeline architecture.
 * Also extends ContentNavigator for backward compatibility.
 */
export default class RelativePriorityNavigator extends ContentNavigator implements CardFilter {
  private config: RelativePriorityConfig;

  /** Human-readable name for CardFilter interface */
  name: string;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super(user, course, strategyData);
    this.config = this.parseConfig(strategyData.serializedData);
    this.name = strategyData.name || 'Relative Priority';
  }

  private parseConfig(serializedData: string): RelativePriorityConfig {
    try {
      const parsed = JSON.parse(serializedData);
      return {
        tagPriorities: parsed.tagPriorities || {},
        defaultPriority: parsed.defaultPriority ?? DEFAULT_PRIORITY,
        combineMode: parsed.combineMode ?? DEFAULT_COMBINE_MODE,
        priorityInfluence: parsed.priorityInfluence ?? DEFAULT_PRIORITY_INFLUENCE,
      };
    } catch {
      // Return safe defaults if parsing fails
      return {
        tagPriorities: {},
        defaultPriority: DEFAULT_PRIORITY,
        combineMode: DEFAULT_COMBINE_MODE,
        priorityInfluence: DEFAULT_PRIORITY_INFLUENCE,
      };
    }
  }

  /**
   * Look up the priority for a tag.
   */
  private getTagPriority(tagId: string): number {
    return this.config.tagPriorities[tagId] ?? this.config.defaultPriority ?? DEFAULT_PRIORITY;
  }

  /**
   * Compute combined priority for a card based on its tags.
   */
  private computeCardPriority(cardTags: string[]): number {
    if (cardTags.length === 0) {
      return this.config.defaultPriority ?? DEFAULT_PRIORITY;
    }

    const priorities = cardTags.map((tag) => this.getTagPriority(tag));

    switch (this.config.combineMode) {
      case 'max':
        return Math.max(...priorities);
      case 'min':
        return Math.min(...priorities);
      case 'average':
        return priorities.reduce((sum, p) => sum + p, 0) / priorities.length;
      default:
        return Math.max(...priorities);
    }
  }

  /**
   * Compute boost factor based on priority.
   *
   * The formula: 1 + (priority - 0.5) * priorityInfluence
   *
   * This creates a multiplier centered around 1.0:
   * - Priority 1.0 with influence 0.5 → 1.25 (25% boost)
   * - Priority 0.5 with any influence → 1.00 (neutral)
   * - Priority 0.0 with influence 0.5 → 0.75 (25% reduction)
   */
  private computeBoostFactor(priority: number): number {
    const influence = this.config.priorityInfluence ?? DEFAULT_PRIORITY_INFLUENCE;
    return 1 + (priority - 0.5) * influence;
  }

  /**
   * Build human-readable reason for priority adjustment.
   */
  private buildPriorityReason(
    cardTags: string[],
    priority: number,
    boostFactor: number,
    finalScore: number
  ): string {
    if (cardTags.length === 0) {
      return `No tags, neutral priority (${priority.toFixed(2)})`;
    }

    const tagList = cardTags.slice(0, 3).join(', ');
    const more = cardTags.length > 3 ? ` (+${cardTags.length - 3} more)` : '';

    if (boostFactor === 1.0) {
      return `Neutral priority (${priority.toFixed(2)}) for tags: ${tagList}${more}`;
    } else if (boostFactor > 1.0) {
      return `High-priority tags: ${tagList}${more} (priority ${priority.toFixed(2)} → boost ${boostFactor.toFixed(2)}x → ${finalScore.toFixed(2)})`;
    } else {
      return `Low-priority tags: ${tagList}${more} (priority ${priority.toFixed(2)} → reduce ${boostFactor.toFixed(2)}x → ${finalScore.toFixed(2)})`;
    }
  }

  /**
   * CardFilter.transform implementation.
   *
   * Apply priority-adjusted scoring. Cards with high-priority tags get boosted,
   * cards with low-priority tags get reduced scores.
   */
  async transform(cards: WeightedCard[], _context: FilterContext): Promise<WeightedCard[]> {
    const adjusted: WeightedCard[] = await Promise.all(
      cards.map(async (card) => {
        const cardTags = card.tags ?? [];
        const priority = this.computeCardPriority(cardTags);
        const boostFactor = this.computeBoostFactor(priority);
        const finalScore = Math.max(0, Math.min(1, card.score * boostFactor));

        // Determine action based on boost factor
        const action = boostFactor > 1.0 ? 'boosted' : boostFactor < 1.0 ? 'penalized' : 'passed';

        // Build reason explaining priority adjustment
        const reason = this.buildPriorityReason(cardTags, priority, boostFactor, finalScore);

        return {
          ...card,
          score: finalScore,
          provenance: [
            ...card.provenance,
            {
              strategy: 'relativePriority',
              strategyName: this.strategyName || this.name,
              strategyId: this.strategyId || 'NAVIGATION_STRATEGY-priority',
              action,
              score: finalScore,
              reason,
            },
          ],
        };
      })
    );

    return adjusted;
  }

  /**
   * Legacy getWeightedCards - now throws as filters should not be used as generators.
   *
   * Use transform() via Pipeline instead.
   */
  async getWeightedCards(_limit: number): Promise<WeightedCard[]> {
    throw new Error(
      'RelativePriorityNavigator is a filter and should not be used as a generator. ' +
        'Use Pipeline with a generator and this filter via transform().'
    );
  }
}
