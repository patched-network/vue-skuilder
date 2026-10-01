import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import type { ContentNavigationStrategyData } from '../../types/contentNavigationStrategy';
import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import type { GeneratorResult } from '../generators/types';
import type { CardFilter, FilterContext, FilterKind } from './types';
import { COUNT_ONLY_SCORE, isCountOnlyTag, type CourseElo } from '@vue-skuilder/common';
import { logger } from '../../../util/logger';

// ============================================================================
// ELO DISTANCE FILTER
// ============================================================================
//
// Scales every candidate by how close its ELO is to the learner's, on a smooth
// Gaussian (no discontinuities, never zero).
//
// The one place ELO distance counts. Generators retrieve (the ELO generator
// pulls a window of cards near the learner's ELO) and score only on what's
// specific to their source; a signal that applies to every card lives in one
// heap-wide filter, so new cards and reviews are weighed on the same terms:
// - reviews the learner has moved beyond fade, and may never surface over
//   higher-priority work;
// - new cards far from the learner's level rank low (this used to live in the
//   ELO generator's own score, which double-counted alongside this filter).
//
// Tag-aware (opt-in, experimental): a card's difficulty for this learner is
// read on the skills they share, not only on global ELO. Card and learner keep
// paired ratings per tag (each graded response adjusts both), so a tag's gap
// (card − learner) is as meaningful as the global one, and often more: a card
// can sit at the learner's global level while testing their weakest skill.
// See tagAwareGap for the combination. Global distance is the default; a course
// opts in with `tagAware`, a browser with `window.skuilder.multiDimElo = true`
// (see the toggle below), for side-by-side testing.
//
// A `signal`, not a gate: it expresses preference, not readiness. `liveOnly`:
// forecasts and card-space scans start every card at 1.0 without a generator,
// and never applied ELO distance, so they skip it.
//
// The assembler adds this filter (as "ELO Distance (default)") to every
// pipeline whose strategy docs don't declare one. A course tunes it by
// declaring its own `eloDistance` strategy doc with an EloDistanceConfig.
//
// ============================================================================

/**
 * Configuration for the ELO distance curve:
 * `minMultiplier + (maxMultiplier − minMultiplier) · exp(−(distance / halfLife)²)`.
 */
export interface EloDistanceConfig {
  /**
   * The Gaussian's scale in ELO points (despite the name, not a half-life).
   * Default 300: distance 250 → ~0.5, as the ELO generator scored new cards.
   *
   * - distance 0: maxMultiplier
   * - distance = halfLife: ~0.4 (with the default floor)
   * - distance = 2 · halfLife: ~0.07
   */
  halfLife?: number;

  /**
   * Floor, so far-off cards keep a nonzero score (the pipeline drops zero
   * scores before hints, and a hint must be able to lift any card). Default 0.05.
   */
  minMultiplier?: number;

  /** Ceiling. Usually 1.0 (no boost for close cards). Default 1.0. */
  maxMultiplier?: number;

  /**
   * Measure distance on the tags the card and learner share (see
   * tagAwareGap), falling back to global ELO where they share none.
   * Default false. `window.skuilder.multiDimElo` turns it on in one browser.
   */
  tagAware?: boolean;

  /**
   * A learner's tag rating counts once it rests on at least this many graded
   * responses. Count-only (exposure) tags never count. Default 3.
   */
  minTagCount?: number;
}

/**
 * The default curve. The default strategy doc carries it as its config, so
 * the admin pipeline view shows what runs.
 */
export const DEFAULT_ELO_DISTANCE_CONFIG: Required<EloDistanceConfig> = {
  halfLife: 300,
  minMultiplier: 0.05,
  maxMultiplier: 1.0,
  tagAware: false,
  minTagCount: 3,
};

/**
 * Graded responses at which a tag's gap carries half its full weight. Thin
 * tag evidence leans on global ELO; well-practised tags dominate.
 */
const TAG_CONFIDENCE_HALF = 10;

/** Fallback card ELO when a card has none recorded. */
const DEFAULT_CARD_ELO = 1000;

function computeMultiplier(
  distance: number,
  halfLife: number,
  minMultiplier: number,
  maxMultiplier: number
): number {
  const normalizedDistance = distance / halfLife;
  const decay = Math.exp(-(normalizedDistance * normalizedDistance));
  return minMultiplier + (maxMultiplier - minMultiplier) * decay;
}

function resolveConfig(config?: EloDistanceConfig): Required<EloDistanceConfig> {
  return { ...DEFAULT_ELO_DISTANCE_CONFIG, ...config };
}

// ----------------------------------------------------------------------------
// Live toggle: window.skuilder.multiDimElo
// ----------------------------------------------------------------------------
//
// `window.skuilder.multiDimElo = true` turns tag-aware distance on in this
// browser, whatever the strategy config says; `false` returns it to the
// config. Read on every run, so it takes effect at the next replan. Kept in
// localStorage so it survives reloads across a testing stretch. Runs it shapes
// say so in every card's ELO distance reason ("tag-aware").

const MULTI_DIM_ELO_KEY = 'skuilder:multiDimElo';

let multiDimElo = readMultiDimElo();

function readMultiDimElo(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MULTI_DIM_ELO_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mount the toggle on window.skuilder.multiDimElo.
 */
export function mountMultiDimEloToggle(): void {
  if (typeof window === 'undefined') return;

  const win = window as any;
  win.skuilder = win.skuilder || {};
  Object.defineProperty(win.skuilder, 'multiDimElo', {
    configurable: true,
    enumerable: true,
    get: () => multiDimElo,
    set: (on: unknown) => {
      multiDimElo = on === true;
      try {
        if (multiDimElo) localStorage.setItem(MULTI_DIM_ELO_KEY, 'true');
        else localStorage.removeItem(MULTI_DIM_ELO_KEY);
      } catch (e) {
        logger.warn(`[EloDistance] multiDimElo not persisted (localStorage unavailable): ${e}`);
      }
      logger.info(
        `[EloDistance] multiDimElo ${multiDimElo ? 'on: tag-aware' : 'off: per strategy config'}` +
          ' ELO distance from the next replan'
      );
    },
  });
}

// Auto-mount when module is loaded
mountMultiDimEloToggle();

/** One shared tag's contribution to a card's tag-aware gap. */
interface TagGap {
  tag: string;
  /** Card's tag rating minus the learner's: positive = harder than their level. */
  gap: number;
  weight: number;
}

/**
 * The card's difficulty for this learner, in ELO points (card − learner),
 * read on the tags they share.
 *
 * - Shared tags: the card's tags on which the learner has a real rating
 *   (not a bookkeeping role, nor the count-only sentinel) resting on at least
 *   `minTagCount` graded responses. A card with no rating of its own on a tag
 *   uses its global, as the ELO update does when it first grades that tag.
 * - Each tag's gap is weighted by the learner's evidence on it,
 *   n / (n + TAG_CONFIDENCE_HALF).
 * - The weighted mean of the tag gaps is blended with the global gap by the
 *   total evidence W: λ = W / (W + 1). One thin tag barely moves it; several
 *   practised tags dominate it.
 *
 * OPEN (draft, 2026-10-01). Shipped on by default in 0.2.29 by accident (it
 * rode along in the version-bump commit); off by default since, and live only
 * behind the toggle. On one LP learner's 09-30 dump the effect was modest: every touched card shared a rated tag
 * (median 4); mean multiplier ×0.70 → ×0.75 over 352 touched cards, ×0.84 →
 * ×0.88 over 42 due reviews. The biggest movers were old who-said-that cards:
 * ~400 below the learner globally, ~280 below on their own skills.
 *
 * 1. Compensatory or conjunctive. This averages: a weak skill is offset by
 *    strong ones. For spelling a word, which needs every grapheme, the hardest
 *    shared skill arguably sets the difficulty: take the largest gap instead.
 *    The main design question.
 * 2. Which tags count. Broad tags (`concept:match:simple`, `ui:*`) sit on most
 *    cards and act like a second global rating. The framework may want the
 *    course to say which tags are skills (cf. LP's diagnostics interpreter
 *    `isSkillTag`), e.g. as tag patterns in the strategy config.
 * 3. New cards matter most, and that dump couldn't show them. An unseen
 *    card's tag ratings fall back to its global, so for new cards this reads
 *    "card global vs the learner's rating on that skill". Measuring it needs a
 *    `--course all` dump.
 * 4. Cost. Tag-aware fetches full ratings for every candidate (~500 card docs
 *    per run); global-only fetches only reviews'.
 * 5. Retrieval stays global. The ELO generator's window is the cards nearest
 *    the learner's global ELO, so a card that's well matched on its skills but
 *    far off globally may never be retrieved.
 * 6. Target. Distance 0 means ~50% expected success. Early learners may do
 *    better aiming higher: a shift of the curve's centre, independent of this.
 */
export function tagAwareGap(
  cardTags: readonly string[],
  cardElo: CourseElo,
  userElo: CourseElo,
  minTagCount: number
): { gap: number; globalGap: number; tags: TagGap[] } {
  const globalGap = cardElo.global.score - userElo.global.score;
  const tags: TagGap[] = [];
  for (const tag of cardTags) {
    const user = userElo.tags[tag];
    if (isCountOnlyTag(tag) || !user || user.score === COUNT_ONLY_SCORE || user.count < minTagCount) {
      continue;
    }
    const card = cardElo.tags[tag]?.score ?? cardElo.global.score;
    tags.push({
      tag,
      gap: card - user.score,
      weight: user.count / (user.count + TAG_CONFIDENCE_HALF),
    });
  }
  if (tags.length === 0) return { gap: globalGap, globalGap, tags };

  const total = tags.reduce((w, t) => w + t.weight, 0);
  const tagGap = tags.reduce((g, t) => g + t.weight * t.gap, 0) / total;
  const lambda = total / (total + 1);
  return { gap: lambda * tagGap + (1 - lambda) * globalGap, globalGap, tags };
}

function tagReason(tags: TagGap[], globalGap: number): string {
  const shown = [...tags]
    .sort((a, b) => Math.abs(b.gap) * b.weight - Math.abs(a.gap) * a.weight)
    .slice(0, 3)
    .map((t) => `${t.tag} ${t.gap >= 0 ? '+' : ''}${Math.round(t.gap)}`)
    .join(', ');
  const more = tags.length > 3 ? `, +${tags.length - 3} more` : '';
  return ` on ${tags.length} shared tag(s) [${shown}${more}] (global ${globalGap >= 0 ? '+' : ''}${Math.round(globalGap)})`;
}

async function applyEloDistance(
  cards: WeightedCard[],
  context: FilterContext,
  config: Required<EloDistanceConfig>,
  source: { name: string; strategyId: string }
): Promise<WeightedCard[]> {
  const { course, userElo, userCourseElo } = context;
  const { halfLife, minMultiplier, maxMultiplier } = config;
  const tagAware = (config.tagAware || multiDimElo) && userCourseElo !== undefined;

  // Tag-aware needs every card's full ratings; otherwise only the ELO of cards
  // that don't carry it (reviews). One batch either way.
  const missing = cards.filter((c) => tagAware || c.cardElo === undefined).map((c) => c.cardId);
  const fetched = new Map<string, CourseElo>();
  if (missing.length > 0) {
    const elos = await course.getCardEloData(missing);
    missing.forEach((id, i) => {
      if (elos[i]) fetched.set(id, elos[i]);
    });
  }

  return cards.map((card) => {
    const full = fetched.get(card.cardId);
    const cardElo = full?.global?.score ?? card.cardElo ?? DEFAULT_CARD_ELO;

    let distance = Math.abs(cardElo - userElo);
    let how = '';
    if (tagAware) {
      const t = full ? tagAwareGap(card.tags ?? [], full, userCourseElo!, config.minTagCount) : undefined;
      if (t) distance = Math.abs(t.gap);
      how = t?.tags.length
        ? `, tag-aware${tagReason(t.tags, t.globalGap)}`
        : ', tag-aware: global (no shared tags)';
    }

    const multiplier = computeMultiplier(distance, halfLife, minMultiplier, maxMultiplier);
    const newScore = card.score * multiplier;
    const action = multiplier < maxMultiplier - 0.01 ? 'penalized' : 'passed';

    return {
      ...card,
      cardElo,
      score: newScore,
      provenance: [
        ...card.provenance,
        {
          strategy: 'eloDistance',
          strategyName: source.name,
          strategyId: source.strategyId,
          action,
          score: newScore,
          reason: `ELO distance ${Math.round(distance)} (card: ${Math.round(cardElo)}, user: ${Math.round(userElo)})${how} → ${multiplier.toFixed(2)}x`,
        },
      ],
    };
  });
}

/**
 * Create an ELO distance filter outside the strategy-doc path.
 *
 * @param config - Optional configuration for the curve
 */
export function createEloDistanceFilter(config?: EloDistanceConfig): CardFilter {
  const resolved = resolveConfig(config);
  const source = { name: 'ELO Distance Filter', strategyId: 'ELO_DISTANCE_FILTER' };
  return {
    name: source.name,
    kind: 'signal',
    liveOnly: true,
    transform: (cards, context) => applyEloDistance(cards, context, resolved, source),
  };
}

/**
 * The ELO distance filter as a strategy-doc navigator (`implementingClass:
 * 'eloDistance'`, serializedData: an EloDistanceConfig as JSON, or empty).
 */
export default class EloDistanceFilter extends ContentNavigator implements CardFilter {
  name: string;
  /** See CardFilter.kind. Static, so the pipeline plan can read it without an instance. */
  static readonly kind: FilterKind = 'signal';
  readonly kind = EloDistanceFilter.kind;
  readonly liveOnly = true;
  private config: Required<EloDistanceConfig>;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super(user, course, strategyData);
    this.name = strategyData.name || 'ELO Distance';
    let parsed: EloDistanceConfig | undefined;
    try {
      parsed = strategyData.serializedData ? JSON.parse(strategyData.serializedData) : undefined;
    } catch {
      parsed = undefined;
    }
    this.config = resolveConfig(parsed);
  }

  transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    return applyEloDistance(cards, context, this.config, {
      name: this.name,
      strategyId: this.strategyId || 'NAVIGATION_STRATEGY-eloDistance-default',
    });
  }

  async getWeightedCards(_limit: number): Promise<GeneratorResult> {
    throw new Error(
      'EloDistanceFilter is a filter and should not be used as a generator. ' +
        'Use Pipeline with a generator and this filter via transform().'
    );
  }
}
