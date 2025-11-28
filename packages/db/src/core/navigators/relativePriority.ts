import { ScheduledCard } from '../types/user';
import { CourseDBInterface } from '../interfaces/courseDB';
import { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator, WeightedCard } from './index';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { StudySessionReviewItem, StudySessionNewItem, DocType } from '..';

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

  /** Strategy to delegate to for candidate generation (default: "elo") */
  delegateStrategy?: string;
}

const DEFAULT_PRIORITY = 0.5;
const DEFAULT_PRIORITY_INFLUENCE = 0.5;
const DEFAULT_COMBINE_MODE: 'max' | 'average' | 'min' = 'max';

/**
 * A navigation strategy that boosts scores for high-utility content.
 *
 * Course authors assign priority weights to tags. Cards with high-priority
 * tags get boosted scores, making them more likely to be presented first.
 * This allows teaching the most useful, well-behaved concepts before
 * moving on to rarer or more irregular ones.
 *
 * Uses the delegate pattern: wraps another strategy and adjusts its scores
 * based on the priority of each card's tags.
 *
 * Example: When teaching phonics, prioritize common letters (s, t, a) over
 * rare ones (x, z, q) by assigning higher priority weights to common letters.
 */
export default class RelativePriorityNavigator extends ContentNavigator {
  private user: UserDBInterface;
  private course: CourseDBInterface;
  private config: RelativePriorityConfig;
  private delegate: ContentNavigator | null = null;
  private strategyData: ContentNavigationStrategyData;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super();
    this.user = user;
    this.course = course;
    this.strategyData = strategyData;
    this.config = this.parseConfig(strategyData.serializedData);
  }

  private parseConfig(serializedData: string): RelativePriorityConfig {
    try {
      const parsed = JSON.parse(serializedData);
      return {
        tagPriorities: parsed.tagPriorities || {},
        defaultPriority: parsed.defaultPriority ?? DEFAULT_PRIORITY,
        combineMode: parsed.combineMode ?? DEFAULT_COMBINE_MODE,
        priorityInfluence: parsed.priorityInfluence ?? DEFAULT_PRIORITY_INFLUENCE,
        delegateStrategy: parsed.delegateStrategy || 'elo',
      };
    } catch {
      // Return safe defaults if parsing fails
      return {
        tagPriorities: {},
        defaultPriority: DEFAULT_PRIORITY,
        combineMode: DEFAULT_COMBINE_MODE,
        priorityInfluence: DEFAULT_PRIORITY_INFLUENCE,
        delegateStrategy: 'elo',
      };
    }
  }

  /**
   * Lazily initializes and returns the delegate navigator.
   */
  private async getDelegate(): Promise<ContentNavigator> {
    if (!this.delegate) {
      const delegateStrategyData: ContentNavigationStrategyData = {
        _id: `NAVIGATION_STRATEGY-${this.config.delegateStrategy}-delegate`,
        docType: DocType.NAVIGATION_STRATEGY,
        name: `${this.config.delegateStrategy} (delegate)`,
        description: 'Delegate strategy for relative priority',
        implementingClass: this.config.delegateStrategy || 'elo',
        serializedData: '{}',
      };
      this.delegate = await ContentNavigator.create(this.user, this.course, delegateStrategyData);
    }
    return this.delegate;
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
   * Get weighted cards with priority-adjusted scores.
   *
   * Cards with high-priority tags get boosted scores.
   * Cards with low-priority tags get reduced scores.
   * Cards with neutral priority (0.5) are unchanged.
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const delegate = await this.getDelegate();

    // Get candidates from delegate
    // Over-fetch slightly to account for score reordering
    const candidates = await delegate.getWeightedCards(Math.ceil(limit * 1.5));

    // Adjust scores based on priority
    const adjusted: WeightedCard[] = await Promise.all(
      candidates.map(async (card) => {
        const cardTags = await this.course.getAppliedTags(card.cardId);
        const priority = this.computeCardPriority(cardTags);
        const boostFactor = this.computeBoostFactor(priority);

        return {
          ...card,
          // Apply boost factor, clamp to [0, 1] range
          score: Math.max(0, Math.min(1, card.score * boostFactor)),
        };
      })
    );

    // Sort by adjusted score descending
    adjusted.sort((a, b) => b.score - a.score);

    // Return up to limit
    return adjusted.slice(0, limit);
  }

  /**
   * Legacy method: delegates to wrapped strategy.
   */
  async getNewCards(n?: number): Promise<StudySessionNewItem[]> {
    const delegate = await this.getDelegate();
    return delegate.getNewCards(n);
  }

  /**
   * Legacy method: delegates to wrapped strategy.
   */
  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const delegate = await this.getDelegate();
    return delegate.getPendingReviews();
  }
}
