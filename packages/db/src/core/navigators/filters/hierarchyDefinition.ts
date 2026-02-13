import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import type { ContentNavigationStrategyData } from '../../types/contentNavigationStrategy';
import type { CardFilter, FilterContext } from './types';
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
}

const DEFAULT_MIN_COUNT = 3;

/**
 * A filter strategy that gates cards based on prerequisite mastery.
 *
 * Cards are locked until the user masters all prerequisite tags.
 * Locked cards receive score * 0.01 (strong penalty, not hard filter).
 *
 * Mastery is determined by:
 * - User's ELO for the tag exceeds threshold (or avgElo if not specified)
 * - User has minimum interaction count with the tag
 *
 * Tags with no prerequisites are always unlocked.
 *
 * Implements CardFilter for use in Pipeline architecture.
 * Also extends ContentNavigator for backward compatibility.
 */
export default class HierarchyDefinitionNavigator extends ContentNavigator implements CardFilter {
  private config: HierarchyConfig;

  /** Human-readable name for CardFilter interface */
  name: string;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super(user, course, strategyData);
    this.config = this.parseConfig(strategyData.serializedData);
    this.name = strategyData.name || 'Hierarchy Definition';
  }

  private parseConfig(serializedData: string): HierarchyConfig {
    try {
      const parsed = JSON.parse(serializedData);
      return {
        prerequisites: parsed.prerequisites || {},
      };
    } catch {
      // Return safe defaults if parsing fails
      return {
        prerequisites: {},
      };
    }
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
  private async getMasteredTags(context: FilterContext): Promise<Set<string>> {
    const mastered = new Set<string>();

    try {
      const courseReg = await context.user.getCourseRegDoc(context.course.getCourseID());
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
   * Check if a card is unlocked and generate reason.
   */
  private async checkCardUnlock(
    card: WeightedCard,
    _course: CourseDBInterface,
    unlockedTags: Set<string>,
    masteredTags: Set<string>
  ): Promise<{ isUnlocked: boolean; reason: string }> {
    try {
      // Pipeline hydrates tags before filters run
      const cardTags = card.tags ?? [];

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

  /**
   * CardFilter.transform implementation.
   *
   * Apply prerequisite gating to cards. Cards with locked tags receive score * 0.01.
   */
  async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    // Get mastery state
    const masteredTags = await this.getMasteredTags(context);
    const unlockedTags = this.getUnlockedTags(masteredTags);

    // Apply prerequisite gating as score multiplier
    const gated: WeightedCard[] = [];

    for (const card of cards) {
      const { isUnlocked, reason } = await this.checkCardUnlock(
        card,
        context.course,
        unlockedTags,
        masteredTags
      );
      const LOCKED_PENALTY = 0.01;
      const finalScore = isUnlocked ? card.score : card.score * LOCKED_PENALTY;
      const action = isUnlocked ? 'passed' : 'penalized';

      gated.push({
        ...card,
        score: finalScore,
        provenance: [
          ...card.provenance,
          {
            strategy: 'hierarchyDefinition',
            strategyName: this.strategyName || this.name,
            strategyId: this.strategyId || 'NAVIGATION_STRATEGY-hierarchy',
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
   * Legacy getWeightedCards - now throws as filters should not be used as generators.
   *
   * Use transform() via Pipeline instead.
   */
  async getWeightedCards(_limit: number): Promise<WeightedCard[]> {
    throw new Error(
      'HierarchyDefinitionNavigator is a filter and should not be used as a generator. ' +
        'Use Pipeline with a generator and this filter via transform().'
    );
  }
}
