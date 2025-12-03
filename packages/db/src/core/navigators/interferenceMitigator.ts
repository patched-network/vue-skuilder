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
/**
 * A single interference group with its own decay coefficient.
 */
export interface InterferenceGroup {
  /** Tags that interfere with each other in this group */
  tags: string[];
  /** How strongly these tags interfere (0-1, default: 0.8). Higher = stronger avoidance. */
  decay?: number;
}

export interface InterferenceConfig {
  /**
   * Groups of tags that interfere with each other.
   * Each group can have its own decay coefficient.
   *
   * Example: [
   *   { tags: ["b", "d", "p"], decay: 0.9 },  // visual similarity - strong
   *   { tags: ["d", "t"], decay: 0.7 },       // phonetic similarity - moderate
   *   { tags: ["m", "n"], decay: 0.8 }
   * ]
   */
  interferenceSets: InterferenceGroup[];

  /**
   * Threshold below which a tag is considered "immature" (still being learned).
   * Immature tags trigger interference avoidance for their interference partners.
   */
  maturityThreshold?: {
    /** Minimum interaction count to be considered mature (default: 10) */
    minCount?: number;
    /** Minimum ELO score to be considered mature (optional) */
    minElo?: number;
    /**
     * Minimum elapsed time (in days) since first interaction to be considered mature.
     * Prevents recent cramming success from indicating maturity.
     * The skill should be "lindy" — maintained over time.
     */
    minElapsedDays?: number;
  };

  /**
   * Default decay for groups that don't specify their own (0-1, default: 0.8).
   */
  defaultDecay?: number;

  /** Strategy to delegate to for candidate generation (default: "elo") */
  delegateStrategy?: string;
}

const DEFAULT_MIN_COUNT = 10;
const DEFAULT_MIN_ELAPSED_DAYS = 3;
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
  private _strategyData: ContentNavigationStrategyData;

  /** Precomputed map: tag -> set of { partner, decay } it interferes with */
  private interferenceMap: Map<string, Array<{ partner: string; decay: number }>>;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    _strategyData: ContentNavigationStrategyData
  ) {
    super();
    this.user = user;
    this.course = course;
    this._strategyData = _strategyData;
    this.config = this.parseConfig(_strategyData.serializedData);
    this.interferenceMap = this.buildInterferenceMap();
  }

  private parseConfig(serializedData: string): InterferenceConfig {
    try {
      const parsed = JSON.parse(serializedData);
      // Normalize legacy format (string[][]) to new format (InterferenceGroup[])
      let sets: InterferenceGroup[] = parsed.interferenceSets || [];
      if (sets.length > 0 && Array.isArray(sets[0])) {
        // Legacy format: convert string[][] to InterferenceGroup[]
        sets = (sets as unknown as string[][]).map((tags) => ({ tags }));
      }

      return {
        interferenceSets: sets,
        maturityThreshold: {
          minCount: parsed.maturityThreshold?.minCount ?? DEFAULT_MIN_COUNT,
          minElo: parsed.maturityThreshold?.minElo,
          minElapsedDays: parsed.maturityThreshold?.minElapsedDays ?? DEFAULT_MIN_ELAPSED_DAYS,
        },
        defaultDecay: parsed.defaultDecay ?? DEFAULT_INTERFERENCE_DECAY,
        delegateStrategy: parsed.delegateStrategy || 'elo',
      };
    } catch {
      return {
        interferenceSets: [],
        maturityThreshold: {
          minCount: DEFAULT_MIN_COUNT,
          minElapsedDays: DEFAULT_MIN_ELAPSED_DAYS,
        },
        defaultDecay: DEFAULT_INTERFERENCE_DECAY,
        delegateStrategy: 'elo',
      };
    }
  }

  /**
   * Build a map from each tag to its interference partners with decay coefficients.
   * If tags A, B, C are in an interference group with decay 0.8, then:
   * - A interferes with B (decay 0.8) and C (decay 0.8)
   * - B interferes with A (decay 0.8) and C (decay 0.8)
   * - etc.
   */
  private buildInterferenceMap(): Map<string, Array<{ partner: string; decay: number }>> {
    const map = new Map<string, Array<{ partner: string; decay: number }>>();

    for (const group of this.config.interferenceSets) {
      const decay = group.decay ?? this.config.defaultDecay ?? DEFAULT_INTERFERENCE_DECAY;

      for (const tag of group.tags) {
        if (!map.has(tag)) {
          map.set(tag, []);
        }
        const partners = map.get(tag)!;
        for (const other of group.tags) {
          if (other !== tag) {
            // Check if partner already exists (from overlapping groups)
            const existing = partners.find((p) => p.partner === other);
            if (existing) {
              // Use the stronger (higher) decay
              existing.decay = Math.max(existing.decay, decay);
            } else {
              partners.push({ partner: other, decay });
            }
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
        course: this.course.getCourseID(),
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

      // TODO: To properly check elapsed time, we need access to first interaction timestamp.
      // For now, we use count as a proxy (more interactions = more time elapsed).
      // Future: query card history for earliest timestamp per tag.
      const minElapsedDays =
        this.config.maturityThreshold?.minElapsedDays ?? DEFAULT_MIN_ELAPSED_DAYS;
      const minCountForElapsed = minElapsedDays * 2; // Rough proxy: ~2 interactions per day

      for (const [tagId, tagElo] of Object.entries(userElo.tags)) {
        // Only consider tags that have been started (count > 0)
        if (tagElo.count === 0) continue;

        // Check if below maturity threshold
        const belowCount = tagElo.count < minCount;
        const belowElo = minElo !== undefined && tagElo.score < minElo;
        const belowElapsed = tagElo.count < minCountForElapsed; // Proxy for time

        if (belowCount || belowElo || belowElapsed) {
          immature.add(tagId);
        }
      }
    } catch {
      // If we can't get user data, assume no immature tags
    }

    return immature;
  }

  /**
   * Get all tags that interfere with any immature tag, along with their decay coefficients.
   * These are the tags we want to avoid introducing.
   */
  private getTagsToAvoid(immatureTags: Set<string>): Map<string, number> {
    const avoid = new Map<string, number>();

    for (const immatureTag of immatureTags) {
      const partners = this.interferenceMap.get(immatureTag);
      if (partners) {
        for (const { partner, decay } of partners) {
          // Avoid the partner, but not if it's also immature
          // (if both are immature, we're already learning both)
          if (!immatureTags.has(partner)) {
            // Use the strongest (highest) decay if partner appears multiple times
            const existing = avoid.get(partner) ?? 0;
            avoid.set(partner, Math.max(existing, decay));
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
   * Returns: { multiplier, interfering tags, reason }
   */
  private computeInterferenceEffect(
    cardTags: string[],
    tagsToAvoid: Map<string, number>,
    immatureTags: Set<string>
  ): { multiplier: number; interferingTags: string[]; reason: string } {
    if (tagsToAvoid.size === 0) {
      return {
        multiplier: 1.0,
        interferingTags: [],
        reason: 'No interference detected',
      };
    }

    let multiplier = 1.0;
    const interferingTags: string[] = [];

    for (const tag of cardTags) {
      const decay = tagsToAvoid.get(tag);
      if (decay !== undefined) {
        interferingTags.push(tag);
        multiplier *= 1.0 - decay;
      }
    }

    if (interferingTags.length === 0) {
      return {
        multiplier: 1.0,
        interferingTags: [],
        reason: 'No interference detected',
      };
    }

    // Find which immature tags these interfere with
    const causingTags = new Set<string>();
    for (const tag of interferingTags) {
      for (const immatureTag of immatureTags) {
        const partners = this.interferenceMap.get(immatureTag);
        if (partners?.some((p) => p.partner === tag)) {
          causingTags.add(immatureTag);
        }
      }
    }

    const reason = `Interferes with immature tags ${Array.from(causingTags).join(', ')} (tags: ${interferingTags.join(', ')}, multiplier: ${multiplier.toFixed(2)})`;

    return { multiplier, interferingTags, reason };
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
      const { multiplier, reason } = this.computeInterferenceEffect(
        cardTags,
        tagsToAvoid,
        immatureTags
      );
      const finalScore = card.score * multiplier;

      const action =
        multiplier < 1.0 ? 'penalized' : multiplier > 1.0 ? 'boosted' : 'passed';

      adjusted.push({
        ...card,
        score: finalScore,
        provenance: [
          ...card.provenance,
          {
            strategy: 'interferenceMitigator',
            action,
            score: finalScore,
            reason,
          },
        ],
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
