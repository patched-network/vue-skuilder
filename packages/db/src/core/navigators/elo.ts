import type { CourseDBInterface } from '../interfaces/courseDB';
import type { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator } from './index';
import type { WeightedCard } from './index';
import { toCourseElo } from '@vue-skuilder/common';
import type { QualifiedCardID } from '..';
import type { CardGenerator, GeneratorContext } from './generators/types';

// ============================================================================
// ELO NAVIGATOR
// ============================================================================
//
// A generator strategy that selects new cards based on ELO proximity.
//
// Cards closer to the user's skill level (ELO) receive higher scores.
// This ensures learners see content matched to their current ability.
//
// NOTE: This generator only handles NEW cards. Reviews are handled by
// SRSNavigator. Use CompositeGenerator to combine both.
//
// ============================================================================

/**
 * A navigation strategy that scores new cards by ELO proximity.
 *
 * Implements CardGenerator for use in Pipeline architecture.
 * Also extends ContentNavigator for backward compatibility with legacy code.
 *
 * Higher scores indicate better ELO match:
 * - Cards at user's ELO level score highest
 * - Score decreases with ELO distance
 *
 * Only returns new cards - use SRSNavigator for reviews.
 */
export default class ELONavigator extends ContentNavigator implements CardGenerator {
  /** Human-readable name for CardGenerator interface */
  name: string;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData?: { name: string; _id: string }
    // The ELO strategy is non-parameterized.
    //
    // It instead relies on existing meta data from the course and user with respect to
    // ELO scores - it uses those to select cards matched to user skill level.
  ) {
    super(user, course, strategyData as any);
    this.name = strategyData?.name || 'ELO';
  }

  /**
   * Get new cards with suitability scores based on ELO distance.
   *
   * Cards closer to user's ELO get higher scores.
   * Score formula: max(0, 1 - distance / 500)
   *
   * NOTE: This generator only handles NEW cards. Reviews are handled by
   * SRSNavigator. Use CompositeGenerator to combine both.
   *
   * This method supports both the legacy signature (limit only) and the
   * CardGenerator interface signature (limit, context).
   *
   * @param limit - Maximum number of cards to return
   * @param context - Optional GeneratorContext (used when called via Pipeline)
   */
  async getWeightedCards(limit: number, context?: GeneratorContext): Promise<WeightedCard[]> {
    // Determine user ELO - from context if available, otherwise fetch
    let userGlobalElo: number;
    if (context?.userElo !== undefined) {
      userGlobalElo = context.userElo;
    } else {
      const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
      const userElo = toCourseElo(courseReg.elo);
      userGlobalElo = userElo.global.score;
    }

    // Get new cards - inline from getNewCards()
    const activeCards = await this.user.getActiveCards();
    const newCards = (
      await this.course.getCardsCenteredAtELO(
        { limit, elo: 'user' },
        (c: QualifiedCardID) => !activeCards.some((ac) => c.cardID === ac.cardID)
      )
    ).map((c) => ({ ...c, status: 'new' as const }));

    // Get ELO data for all cards in one batch
    const cardIds = newCards.map((c) => c.cardID);
    const cardEloData = await this.course.getCardEloData(cardIds);

    // Score new cards by ELO distance
    const scored: WeightedCard[] = newCards.map((c, i) => {
      const cardElo = cardEloData[i]?.global?.score ?? 1000;
      const distance = Math.abs(cardElo - userGlobalElo);
      const score = Math.max(0, 1 - distance / 500);

      return {
        cardId: c.cardID,
        courseId: c.courseID,
        score,
        provenance: [
          {
            strategy: 'elo',
            strategyName: this.strategyName || this.name,
            strategyId: this.strategyId || 'NAVIGATION_STRATEGY-ELO-default',
            action: 'generated',
            score,
            reason: `ELO distance ${Math.round(distance)} (card: ${Math.round(cardElo)}, user: ${Math.round(userGlobalElo)}), new card`,
          },
        ],
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
  }
}
