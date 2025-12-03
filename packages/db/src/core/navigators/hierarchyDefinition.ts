import { ScheduledCard } from '../types/user';
import { CourseDBInterface } from '../interfaces/courseDB';
import { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator, WeightedCard } from './index';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { StudySessionReviewItem, StudySessionNewItem, DocType } from '..';
import { toCourseElo } from '@vue-skuilder/common';

/**
 * A single prerequisite requirement for a tag.
 * Each prerequisite refers to one tag with its own mastery threshold.
 */
interface TagPrerequisite {
  /** The tag that must be mastered */
  tag: string;
  /** Thresholds for considering this prerequisite tag "mastered" */
  masteryThreshold?: {
    /** Minimum ELO score for mastery. If not set, uses avgElo comparison */
    minElo?: number;
    /** Minimum interaction count (default: 3) */
    minCount?: number;
  };
}

/**
 * Configuration for the HierarchyDefinition strategy
 */
export interface HierarchyConfig {
  /** Map of tag ID to its list of prerequisites (each with individual thresholds) */
  prerequisites: {
    [tagId: string]: TagPrerequisite[];
  };
  /** Strategy to delegate to for candidate generation (default: "elo") */
  delegateStrategy?: string;
}

const DEFAULT_MIN_COUNT = 3;

/**
 * A navigation strategy that gates cards based on prerequisite mastery.
 *
 * Cards are locked until the user masters all prerequisite tags.
 * This implements the delegate pattern: it wraps another strategy
 * and filters its output based on prerequisite constraints.
 *
 * Mastery is determined by:
 * - User's ELO for the tag exceeds threshold (or avgElo if not specified)
 * - User has minimum interaction count with the tag
 *
 * Tags with no prerequisites are always unlocked.
 */
export default class HierarchyDefinitionNavigator extends ContentNavigator {
  private user: UserDBInterface;
  private course: CourseDBInterface;
  private config: HierarchyConfig;
  private delegate: ContentNavigator | null = null;
  private _strategyData: ContentNavigationStrategyData;

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
  }

  private parseConfig(serializedData: string): HierarchyConfig {
    try {
      const parsed = JSON.parse(serializedData);
      return {
        prerequisites: parsed.prerequisites || {},
        delegateStrategy: parsed.delegateStrategy || 'elo',
      };
    } catch {
      // Return safe defaults if parsing fails
      return {
        prerequisites: {},
        delegateStrategy: 'elo',
      };
    }
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
        description: 'Delegate strategy for hierarchy definition',
        implementingClass: this.config.delegateStrategy || 'elo',
        serializedData: '{}',
      };
      this.delegate = await ContentNavigator.create(this.user, this.course, delegateStrategyData);
    }
    return this.delegate;
  }

  /**
   * Check if a specific prerequisite is satisfied
   */
  private isPrerequisiteMet(
    prereq: TagPrerequisite,
    userTagElo: { score: number; count: number } | undefined,
    userGlobalElo: number
  ): boolean {
    if (!userTagElo) return false;

    const minCount = prereq.masteryThreshold?.minCount ?? DEFAULT_MIN_COUNT;
    if (userTagElo.count < minCount) return false;

    if (prereq.masteryThreshold?.minElo !== undefined) {
      return userTagElo.score >= prereq.masteryThreshold.minElo;
    } else {
      // Default: user ELO for tag > global user ELO (proxy for "above average")
      return userTagElo.score >= userGlobalElo;
    }
  }

  /**
   * Get the set of tags the user has mastered.
   * A tag is "mastered" if it appears as a prerequisite somewhere and meets its threshold.
   */
  private async getMasteredTags(): Promise<Set<string>> {
    const mastered = new Set<string>();

    try {
      const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
      const userElo = toCourseElo(courseReg.elo);

      // Collect all unique prerequisite tags and check mastery for each
      for (const prereqs of Object.values(this.config.prerequisites)) {
        for (const prereq of prereqs) {
          const tagElo = userElo.tags[prereq.tag];
          if (this.isPrerequisiteMet(prereq, tagElo, userElo.global.score)) {
            mastered.add(prereq.tag);
          }
        }
      }
    } catch {
      // If we can't get user data, return empty set (no tags mastered)
    }

    return mastered;
  }

  /**
   * Get the set of tags that are unlocked (prerequisites met)
   */
  private getUnlockedTags(masteredTags: Set<string>): Set<string> {
    const unlocked = new Set<string>();

    for (const [tagId, prereqs] of Object.entries(this.config.prerequisites)) {
      const allPrereqsMet = prereqs.every((prereq) => masteredTags.has(prereq.tag));
      if (allPrereqsMet) {
        unlocked.add(tagId);
      }
    }

    return unlocked;
  }

  /**
   * Check if a tag has prerequisites defined in config
   */
  private hasPrerequisites(tagId: string): boolean {
    return tagId in this.config.prerequisites;
  }

  /**
   * Get cards with prerequisite gating applied.
   *
   * Cards with locked tags (unmet prerequisites) receive score: 0.
   * Cards with unlocked tags preserve their delegate score.
   *
   * Note: We return score: 0 instead of filtering so that:
   * 1. Filter order doesn't matter (all filters are multipliers)
   * 2. Provenance tracking shows all candidates and gating decisions
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const delegate = await this.getDelegate();

    // Get candidates from delegate
    const candidates = await delegate.getWeightedCards(limit);

    // Get mastery state
    const masteredTags = await this.getMasteredTags();
    const unlockedTags = this.getUnlockedTags(masteredTags);

    // Apply prerequisite gating as score multiplier
    const gated: WeightedCard[] = [];

    for (const card of candidates) {
      const { isUnlocked, reason } = await this.checkCardUnlock(
        card.cardId,
        unlockedTags,
        masteredTags
      );
      const finalScore = isUnlocked ? card.score : 0;
      const action = isUnlocked ? 'passed' : 'penalized';

      gated.push({
        ...card,
        score: finalScore,
        provenance: [
          ...card.provenance,
          {
            strategy: 'hierarchyDefinition',
            action,
            score: finalScore,
            reason,
          },
        ],
      });
    }

    return gated;
  }

  /**
   * Check if a card is unlocked and generate reason.
   */
  private async checkCardUnlock(
    cardId: string,
    unlockedTags: Set<string>,
    masteredTags: Set<string>
  ): Promise<{ isUnlocked: boolean; reason: string }> {
    try {
      const tagResponse = await this.course.getAppliedTags(cardId);
      const cardTags = tagResponse.rows.map((row) => row.value?.name || row.key);

      // Check each tag's prerequisite status
      const lockedTags = cardTags.filter(
        (tag) => this.hasPrerequisites(tag) && !unlockedTags.has(tag)
      );

      if (lockedTags.length === 0) {
        const tagList = cardTags.length > 0 ? cardTags.join(', ') : 'none';
        return {
          isUnlocked: true,
          reason: `Prerequisites met, tags: ${tagList}`,
        };
      }

      // Find missing prerequisites for locked tags
      const missingPrereqs = lockedTags.flatMap((tag) => {
        const prereqs = this.config.prerequisites[tag] || [];
        return prereqs.filter((p) => !masteredTags.has(p.tag)).map((p) => p.tag);
      });

      return {
        isUnlocked: false,
        reason: `Blocked: missing prerequisites ${missingPrereqs.join(', ')} for tags ${lockedTags.join(', ')}`,
      };
    } catch {
      // If we can't get tags, assume unlocked (fail open)
      return {
        isUnlocked: true,
        reason: 'Prerequisites check skipped (tag lookup failed)',
      };
    }
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
