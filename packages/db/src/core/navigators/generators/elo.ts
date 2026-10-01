import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import { toCourseElo } from '@vue-skuilder/common';
import type { QualifiedCardID } from '../..';
import type { CardGenerator, GeneratorContext, GeneratorResult } from './types';
import { logger } from '@db/util/logger';

// ============================================================================
// ELO NAVIGATOR
// ============================================================================
//
// A generator strategy that retrieves new cards near the learner's ELO.
//
// It retrieves; it doesn't rank by distance. Scores are a flat jitter in
// [0.5, 1] for session-to-session variety. ELO distance is scored once, for
// new cards and reviews alike, by the ELO distance filter (filters/eloDistance),
// which the assembler adds to every pipeline. Scoring it here too counted it
// twice for new cards and once for reviews.
//
// NOTE: This generator only handles NEW cards. Reviews are handled by
// SRSNavigator. Use CompositeGenerator to combine both.
//
// ============================================================================

/**
 * A navigation strategy that retrieves new cards near the learner's ELO.
 *
 * Implements CardGenerator for use in Pipeline architecture.
 * Also extends ContentNavigator for backward compatibility with legacy code.
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
   * Get the new cards nearest the learner's ELO, each scored with a flat
   * jitter in [0.5, 1]. Carries each card's ELO for the ELO distance filter.
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
  async getWeightedCards(limit: number, context?: GeneratorContext): Promise<GeneratorResult> {
    // const tElo0 = performance.now(); // [perf] parked
    // Determine user ELO - from context if available, otherwise fetch
    let userGlobalElo: number;
    if (context?.userElo !== undefined) {
      userGlobalElo = context.userElo;
    } else {
      const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
      const userElo = toCourseElo(courseReg.elo);
      userGlobalElo = userElo.global.score;
    }
    // const tUser = performance.now(); // [perf] parked

    const activeCards = await this.user.getActiveCards();
    // const tActive = performance.now(); // [perf] parked
    const newCards = (
      await this.course.getCardsCenteredAtELO(
        { limit, elo: 'user' },
        (c: QualifiedCardID) => !activeCards.some((ac) => c.cardID === ac.cardID)
      )
    ).map((c) => ({ ...c, status: 'new' as const }));
    // const tCentered = performance.now(); // [perf] parked
    // [perf] parked 2026-05 (pipeline-docs-workup) — uncomment to re-measure
    // logger.info(
      // `[perf][ELOgen] total=${(tCentered - tElo0).toFixed(0)}ms ` +
        // `(userElo=${(tUser - tElo0).toFixed(0)} ` +
        // `activeCards=${(tActive - tUser).toFixed(0)} ` +
        // `centeredAtELO=${(tCentered - tActive).toFixed(0)}) ` +
        // `[active=${activeCards.length} candidates=${newCards.length}]`
    // );

    // Retrieval is by ELO (the window above); scoring isn't. Each card gets a
    // jitter in [0.5, 1] so near-equal cards shuffle between sessions instead of
    // looping. Distance is scored by the ELO distance filter, on the Gaussian
    // this generator used to apply itself (sigma 300, never zero, so a
    // downstream boost can always lift a low-ELO target; see filters/eloDistance
    // and packages/db/docs/todo-intro-concept-emphasis-and-retrieval.md).
    //
    // Card ELO is read from the pooled `.elo` carried on each candidate by
    // getCardsCenteredAtELO, and passed on as `cardElo` so the filter needn't
    // fetch it again.
    const scored: WeightedCard[] = newCards.map((c) => {
      const cardElo = c.elo ?? 1000;
      const distance = Math.abs(cardElo - userGlobalElo);
      const jitter = 0.5 + 0.5 * Math.random();

      return {
        cardId: c.cardID,
        courseId: c.courseID,
        score: jitter,
        cardElo,
        provenance: [
          {
            strategy: 'elo',
            strategyName: this.strategyName || this.name,
            strategyId: this.strategyId || 'NAVIGATION_STRATEGY-ELO-default',
            action: 'generated',
            score: jitter,
            reason: `new card near learner ELO: distance ${Math.round(distance)} (card: ${Math.round(cardElo)}, user: ${Math.round(userGlobalElo)}), jitter ${jitter.toFixed(3)}`,
          },
        ],
      };
    });

    // Sort by jitter descending (a uniform random sample of the window)
    scored.sort((a, b) => b.score - a.score);

    const cards = scored.slice(0, limit);

    // Log summary for transparency
    if (cards.length > 0) {
      const topScores = cards.slice(0, 3).map((c) => c.score.toFixed(2)).join(', ');
      logger.info(
        `[ELO] Course ${this.course.getCourseID()}: ${cards.length} new cards (top scores: ${topScores})`
      );
    } else {
      logger.info(`[ELO] Course ${this.course.getCourseID()}: No new cards available`);
    }

    return { cards };
  }
}
