import { ScheduledCard } from '../types/user';
import { CourseDBInterface } from '../interfaces/courseDB';
import { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator, WeightedCard } from './index';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { StudySessionReviewItem, StudySessionNewItem, DocType } from '..';
import { toCourseElo } from '@vue-skuilder/common';

/**
 * Configuration for the InterferenceMitigator strategy.
 *
 * Course authors define explicit interference relationships between tags.
 * The mitigator discourages introducing new concepts that interfere with
 * currently immature learnings.
 */
export interface InterferenceConfig {
  /**
   * Groups of tags that interfere with each other.
   * Each group is a set of tags where learning one while another is immature
   * causes confusion.
   *
   * Example: [["b", "d", "p"], ["d", "t"], ["m", "n"]]
   * - b, d, p are visually similar
   * - d, t are phonetically similar
   * - m, n are both visually and phonetically similar
   */
  interferenceSets: string[][];

  /**
   * Threshold below which a tag is considered "immature" (still being learned).
   * Immature tags trigger interference avoidance for their interference partners.
   */
  maturityThreshold?: {
    /** Minimum interaction count to be considered mature (default: 10) */
    minCount?: number;
    /** Minimum ELO score to be considered mature (optional) */
    minElo?: number;
  };

  /**
   * How much to reduce score for interfering cards (0-1, default: 0.8).
   * 0 = no reduction, 1 = full reduction (score becomes 0)
   */
  interferenceDecay?: number;

  /** Strategy to delegate to for candidate generation (default: "elo") */
  delegateStrategy?: string;
}

const DEFAULT_MIN_COUNT = 10;
const DEFAULT_INTERFERENCE_DECAY = 0.8;

/**
 * A navigation strategy that avoids introducing confusable concepts simultaneously.
 *
 * When a user is learning a concept (tag is "immature"), this strategy reduces
 * scores for cards tagged with interfering concepts. This encourages the system
 * to introduce new content that is maximally distant from current learning focus.
 *
 * Example: While learning 'd', prefer introducing 'x' over 'b' (visual interference)
 * or 't' (phonetic interference).
 *
 * Uses the delegate pattern: wraps another strategy and adjusts its scores based
 * on interference relationships with immature tags.
 */
export default class InterferenceMitigatorNavigator extends ContentNavigator {
  private user: UserDBInterface;
  private course: CourseDBInterface;
  private config: InterferenceConfig;
  private delegate: ContentNavigator | null = null;
  private strategyData: ContentNavigationStrategyData;

  /** Precomputed map: tag -> set of tags it interferes with */
  private interferenceMap: Map<string, Set<string>>;

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
    this.interferenceMap = this.buildInterferenceMap();
  }

  private parseConfig(serializedData: string): InterferenceConfig {
    try {
      const parsed = JSON.parse(serializedData);
      return {
        interferenceSets: parsed.interferenceSets || [],
        maturityThreshold: {
          minCount: parsed.maturityThreshold?.minCount ?? DEFAULT_MIN_COUNT,
          minElo: parsed.maturityThreshold?.minElo,
        },
        interferenceDecay: parsed.interferenceDecay ?? DEFAULT_INTERFERENCE_DECAY,
        delegateStrategy: parsed.delegateStrategy || 'elo',
      };
    } catch {
      return {
        interferenceSets: [],
        maturityThreshold: { minCount: DEFAULT_MIN_COUNT },
        interferenceDecay: DEFAULT_INTERFERENCE_DECAY,
        delegateStrategy: 'elo',
      };
    }
  }

  /**
   * Build a map from each tag to the set of tags it interferes with.
   * If tags A, B, C are in an interference set, then:
   * - A interferes with B and C
   * - B interferes with A and C
   * - C interferes with A and B
   */
  private buildInterferenceMap(): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();

    for (const group of this.config.interferenceSets) {
      for (const tag of group) {
        if (!map.has(tag)) {
          map.set(tag, new Set());
        }
        const partners = map.get(tag)!;
        for (const other of group) {
          if (other !== tag) {
            partners.add(other);
          }
        }
      }
    }

    return map;
  }

  /**
   * Lazily create the delegate navigator
   */
  private async getDelegate(): Promise<ContentNavigator> {
    if (!this.delegate) {
      const delegateStrategyData: ContentNavigationStrategyData = {
        _id: `NAVIGATION_STRATEGY-${this.config.delegateStrategy}-delegate`,
        docType: DocType.NAVIGATION_STRATEGY,
        name: `${this.config.delegateStrategy} (delegate)`,
        description: 'Delegate strategy for interference mitigator',
        implementingClass: this.config.delegateStrategy || 'elo',
        serializedData: '{}',
      };
      this.delegate = await ContentNavigator.create(this.user, this.course, delegateStrategyData);
    }
    return this.delegate;
  }

  /**
   * Get the set of tags that are currently immature for this user.
   * A tag is immature if the user has interacted with it but hasn't
   * reached the maturity threshold.
   */
  private async getImmatureTags(): Promise<Set<string>> {
    const immature = new Set<string>();

    try {
      const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
      const userElo = toCourseElo(courseReg.elo);

      const minCount = this.config.maturityThreshold?.minCount ?? DEFAULT_MIN_COUNT;
      const minElo = this.config.maturityThreshold?.minElo;

      for (const [tagId, tagElo] of Object.entries(userElo.tags)) {
        // Only consider tags that have been started (count > 0)
        if (tagElo.count === 0) continue;

        // Check if below maturity threshold
        const belowCount = tagElo.count < minCount;
        const belowElo = minElo !== undefined && tagElo.score < minElo;

        if (belowCount || belowElo) {
          immature.add(tagId);
        }
      }
    } catch {
      // If we can't get user data, assume no immature tags
    }

    return immature;
  }

  /**
   * Get all tags that interfere with any immature tag.
   * These are the tags we want to avoid introducing.
   */
  private getTagsToAvoid(immatureTags: Set<string>): Set<string> {
    const avoid = new Set<string>();

    for (const immatureTag of immatureTags) {
      const partners = this.interferenceMap.get(immatureTag);
      if (partners) {
        for (const partner of partners) {
          // Avoid the partner, but not if it's also immature
          // (if both are immature, we're already learning both)
          if (!immatureTags.has(partner)) {
            avoid.add(partner);
          }
        }
      }
    }

    return avoid;
  }

  /**
   * Get tags for a single card
   */
  private async getCardTags(cardId: string): Promise<string[]> {
    try {
      const tagResponse = await this.course.getAppliedTags(cardId);
      return tagResponse.rows.map((row) => row.value?.name || row.key).filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Compute interference score reduction for a card.
   * Returns a multiplier (0-1) to apply to the card's score.
   * 1.0 = no interference, 0.0 = maximum interference
   */
  private computeInterferenceMultiplier(cardTags: string[], tagsToAvoid: Set<string>): number {
    if (tagsToAvoid.size === 0) return 1.0;

    // Count how many of the card's tags are in the avoid set
    const interferingCount = cardTags.filter((t) => tagsToAvoid.has(t)).length;

    if (interferingCount === 0) return 1.0;

    // Apply decay based on interference
    const decay = this.config.interferenceDecay ?? DEFAULT_INTERFERENCE_DECAY;

    // More interfering tags = stronger reduction
    // One interfering tag: score * (1 - decay)
    // All tags interfering: score * (1 - decay)^n approaches 0
    return Math.pow(1.0 - decay, interferingCount);
  }

  /**
   * Get cards with interference-aware scoring.
   *
   * Cards with tags that interfere with immature learnings get reduced scores.
   * This encourages introducing new concepts that are distant from current focus.
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const delegate = await this.getDelegate();

    // Over-fetch to allow for score reordering
    const candidates = await delegate.getWeightedCards(limit * 3);

    // Identify what to avoid
    const immatureTags = await this.getImmatureTags();
    const tagsToAvoid = this.getTagsToAvoid(immatureTags);

    // Adjust scores based on interference
    const adjusted: WeightedCard[] = [];

    for (const card of candidates) {
      const cardTags = await this.getCardTags(card.cardId);
      const multiplier = this.computeInterferenceMultiplier(cardTags, tagsToAvoid);

      adjusted.push({
        ...card,
        score: card.score * multiplier,
      });
    }

    // Re-sort by adjusted score
    adjusted.sort((a, b) => b.score - a.score);

    return adjusted.slice(0, limit);
  }

  // Legacy methods delegate through

  async getNewCards(n?: number): Promise<StudySessionNewItem[]> {
    const delegate = await this.getDelegate();
    return delegate.getNewCards(n);
  }

  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const delegate = await this.getDelegate();
    return delegate.getPendingReviews();
  }
}
