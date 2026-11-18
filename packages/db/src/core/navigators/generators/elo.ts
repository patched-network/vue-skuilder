import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import { COUNT_ONLY_SCORE, skillNeed, toCourseElo, type CourseElo } from '@vue-skuilder/common';
import type { QualifiedCardID } from '../..';
import type { CardGenerator, GeneratorContext, GeneratorResult } from './types';
import { logger } from '@db/util/logger';
import { skillPressures, type SkillPressureConfig } from '../filters/skillPressure';
import { loadCardsByTag } from './cardsByTag';

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
// SKILL FETCH. The global window can't reach the easier cards a weak skill
// needs: it is centred on the learner's global rating, and a skill behind the
// others wants cards well below it. So, besides the window, the generator
// fetches a few unseen cards for the learner's most pressured skills, by tag,
// aimed below that skill's rating, and appends them to the window's cards.
//
// - Which skills: the same pressure the skill pressure filter reads
//   (filters/skillPressure: the larger of need below the learner's skill
//   median and insecurity), top `maxSkills` among those with unseen cards. Insecurity is what reaches a
//   thin skill with too few responses to rate.
// - Which cards: the skill's card ids, minus cards not new and cards already
//   in the window; the `perSkill` nearest `target = skill rating −
//   targetOffset`, a card's rating being its rating on that tag, else global.
// - Scored like the window (jitter), new, `cardElo` the card's global so the
//   ELO distance filter scores them as usual. Each carries `skillFetch`.
//
// On by default and inert without pressured skills (no exercise-role tags, a
// fresh learner, no userCourseElo in context). A course turns it off, or
// tunes it, with an ELO strategy doc whose serializedData is an
// EloGeneratorConfig as JSON.
//
// ============================================================================

export interface SkillFetchConfig extends SkillPressureConfig {
  /** Default true. */
  enabled?: boolean;
  /** Most pressured skills to fetch for. Default 3. */
  maxSkills?: number;
  /** Cards per skill. Default 4. */
  perSkill?: number;
  /** ELO points below the skill's rating to aim at. Default 250. */
  targetOffset?: number;
  /** Most unseen card ids per skill to rate (a random sample beyond it). Default 300. */
  maxScan?: number;
}

export interface EloGeneratorConfig {
  skillFetch?: SkillFetchConfig;
}

const SKILL_FETCH_DEFAULTS = { maxSkills: 3, perSkill: 4, targetOffset: 250, maxScan: 300 };

function usableScore(score: number | undefined): score is number {
  return typeof score === 'number' && Number.isFinite(score) && score !== COUNT_ONLY_SCORE;
}

function sample<T>(xs: T[], n: number): T[] {
  if (xs.length <= n) return xs;
  const a = [...xs];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

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
  private config: EloGeneratorConfig;
  /**
   * Card ELO read for the skill fetch, by card id. Lives as long as this
   * navigator (cached per course DB, minutes), so replans don't re-read it.
   */
  private _cardEloCache = new Map<string, CourseElo>();

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData?: { name: string; _id: string; serializedData?: string }
    // The window needs no parameters: it reads the course's and the learner's
    // ELO. serializedData, optional, configures the skill fetch.
  ) {
    super(user, course, strategyData as any);
    this.name = strategyData?.name || 'ELO';
    let parsed: EloGeneratorConfig = {};
    try {
      parsed = strategyData?.serializedData ? JSON.parse(strategyData.serializedData) : {};
    } catch {
      logger.warn(`[ELO] Unparseable serializedData on ${strategyData?._id}; using defaults`);
    }
    this.config = parsed && typeof parsed === 'object' ? parsed : {};
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

    // Not new: cards with a pending review, and cards seen without one (e.g.
    // `srs:skip` intros, which must not resurface). As the prescribed generator.
    const [activeCards, seenCards] = await Promise.all([
      this.user.getActiveCards(),
      this.user.getSeenCards(this.course.getCourseID()).catch(() => [] as string[]),
    ]);
    const notNew = new Set([...activeCards.map((ac) => ac.cardID), ...seenCards]);
    // const tActive = performance.now(); // [perf] parked
    // Centre the window on this generator's user's ELO, passed explicitly:
    // `elo: 'user'` would have the course DB resolve its own notion of the
    // current user, which isn't necessarily the user this pipeline runs for
    // (e.g. an admin running a learner's pipeline read-only).
    const newCards = (
      await this.course.getCardsCenteredAtELO(
        { limit, elo: userGlobalElo },
        (c: QualifiedCardID) => !notNew.has(c.cardID)
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

    if (context?.userCourseElo) {
      try {
        const windowIds = new Set(newCards.map((c) => c.cardID));
        const fetched = await this.skillFetch(context.userCourseElo, notNew, windowIds);
        cards.push(...fetched);
      } catch (e) {
        logger.warn(`[ELO] Skill fetch failed, window only: ${e}`);
      }
    }

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

  /** Unseen cards for the learner's most pressured skills. See SKILL FETCH above. */
  private async skillFetch(
    elo: CourseElo,
    notNew: Set<string>,
    windowIds: Set<string>
  ): Promise<WeightedCard[]> {
    const config = this.config.skillFetch ?? {};
    if (config.enabled === false) return [];
    const { maxSkills, perSkill, targetOffset, maxScan } = { ...SKILL_FETCH_DEFAULTS, ...config };

    const pressured = [...skillPressures(elo, config).entries()].sort(
      (a, b) => b[1].pressure - a[1].pressure || a[0].localeCompare(b[0])
    );
    if (pressured.length === 0) return [];

    // The most pressured skills that still have unseen cards outside the
    // window: a skill whose cards are all seen doesn't take a slot.
    const cardsByTag = await loadCardsByTag(this.course);
    const taken = new Set<string>();
    const candidates: { tag: string; entry: (typeof pressured)[number][1]; ids: string[] }[] = [];
    for (const [tag, entry] of pressured) {
      if (candidates.length >= maxSkills) break;
      const unseen = (cardsByTag.get(tag) ?? []).filter(
        (id) => !notNew.has(id) && !windowIds.has(id)
      );
      if (unseen.length > 0) candidates.push({ tag, entry, ids: sample(unseen, maxScan) });
    }
    if (candidates.length === 0) return [];

    const toRead = [
      ...new Set(candidates.flatMap((c) => c.ids).filter((id) => !this._cardEloCache.has(id))),
    ];
    if (toRead.length > 0) {
      const read = await this.course.getCardEloData(toRead);
      toRead.forEach((id, i) => {
        if (read[i]) this._cardEloCache.set(id, read[i]);
      });
    }

    const reference = skillNeed(elo, config).reference;
    const global = elo.global.score;
    const out: WeightedCard[] = [];
    for (const { tag, entry, ids } of candidates) {
      const tagScore = elo.tags[tag]?.score;
      const rating = usableScore(tagScore) ? tagScore : global;
      const target = rating - targetOffset;
      const picks = ids
        .filter((id) => !taken.has(id) && this._cardEloCache.has(id))
        .map((id) => {
          const celo = this._cardEloCache.get(id)!;
          const onTag = celo.tags[tag]?.score;
          return {
            id,
            cardRating: usableScore(onTag) ? onTag : celo.global.score,
            cardGlobal: celo.global.score,
          };
        })
        .sort((a, b) => Math.abs(a.cardRating - target) - Math.abs(b.cardRating - target))
        .slice(0, perSkill);

      for (const p of picks) {
        taken.add(p.id);
        const jitter = 0.5 + 0.5 * Math.random();
        const median = reference === null ? '' : `, median ${Math.round(reference)}`;
        out.push({
          cardId: p.id,
          courseId: this.course.getCourseID(),
          score: jitter,
          cardElo: p.cardGlobal,
          skillFetch: { tag, pressure: entry.pressure },
          provenance: [
            {
              strategy: 'elo',
              strategyName: this.strategyName || this.name,
              strategyId: this.strategyId || 'NAVIGATION_STRATEGY-ELO-default',
              action: 'generated',
              score: jitter,
              reason:
                `new card, skill fetch: ${tag} ${entry.why} (rating ${Math.round(rating)}${median}), ` +
                `target ${Math.round(target)}, card ${Math.round(p.cardRating)}, jitter ${jitter.toFixed(3)}`,
            },
          ],
        });
      }
    }

    if (out.length > 0) {
      logger.info(
        `[ELO] Skill fetch: ${out.length} cards for ${candidates.map((c) => c.tag).join(', ')}`
      );
    }
    return out;
  }
}
