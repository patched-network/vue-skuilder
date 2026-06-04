import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import { toCourseElo } from '@vue-skuilder/common';
import type { QualifiedCardID } from '../..';
import type { CardGenerator, GeneratorContext, GeneratorResult } from './types';
import { logger } from '@db/util/logger';

/**
 * Std-dev (in ELO points) of the Gaussian that converts card↔user ELO distance
 * into a relevance weight. 300 reproduces the legacy linear ramp's half-weight
 * point (distance 250 → ~0.5) while removing its hard zero beyond distance 500.
 */
const ELO_RELEVANCE_SIGMA = 300;

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

    // Score new cards by ELO proximity, then apply bounded multiplicative
    // jitter for session-to-session variety.
    //
    //   relevance = exp(-(distance / SIGMA)^2)   // Gaussian: smooth, always > 0
    //   score     = relevance * (0.5 + 0.5 * U)  // U ~ Uniform(0, 1)
    //
    // This replaces the legacy `rawScore = max(0, 1 - distance/500)` ramp +
    // Efraimidis-Spirakis key `U^(1/rawScore)`, which introduced two
    // discontinuities that defeated downstream replan boosts:
    //   1. The ramp's clamp made every card ≥500 ELO from the user a HARD zero.
    //      The pipeline DELETES zero-score cards (filter score>0) *before* boosts
    //      are applied, so no boost could resurface an under-ELO'd target — e.g.
    //      a freshly-introduced grapheme sitting ~475 below an inflated global
    //      ELO. (See packages/db/docs/todo-intro-concept-emphasis-and-retrieval.md.)
    //   2. The A-Res key `U^(1/rawScore)` ALSO manufactured effective zeros: as
    //      rawScore→0 the exponent explodes and `U^huge` underflows to 0, with
    //      wild variance just above it — so a downstream boost multiplied a
    //      lottery ticket rather than a stable relevance.
    //
    // Gaussian relevance never hits zero (no cliff, survives the score>0 filter,
    // so a boost can always lift a low-ELO target), and the [0.5, 1] jitter keeps
    // ELO ordering up to a 2× factor while still shuffling near-equal cards so the
    // same cards don't loop every session. SIGMA=300 reproduces the old ramp's
    // half-weight point (distance 250 → ~0.5), leaving center-of-range difficulty
    // matching unchanged.
    //
    // Card ELO is read from the pooled `.elo` carried on each candidate by
    // getCardsCenteredAtELO — verified equal to a separate getCardEloData()
    // fetch (0/500 mismatch on real data), so the redundant fetch is gone.
    const scored: WeightedCard[] = newCards.map((c) => {
      const cardElo = c.elo ?? 1000;

      const distance = Math.abs(cardElo - userGlobalElo);
      const relevance = Math.exp(-((distance / ELO_RELEVANCE_SIGMA) ** 2));
      const samplingKey = relevance * (0.5 + 0.5 * Math.random());

      return {
        cardId: c.cardID,
        courseId: c.courseID,
        score: samplingKey,
        provenance: [
          {
            strategy: 'elo',
            strategyName: this.strategyName || this.name,
            strategyId: this.strategyId || 'NAVIGATION_STRATEGY-ELO-default',
            action: 'generated',
            score: samplingKey,
            reason: `ELO distance ${Math.round(distance)} (card: ${Math.round(cardElo)}, user: ${Math.round(userGlobalElo)}), relevance ${relevance.toFixed(3)}, key ${samplingKey.toFixed(3)}`,
          },
        ],
      };
    });

    // Sort by sampling key descending (weighted sample without replacement)
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
