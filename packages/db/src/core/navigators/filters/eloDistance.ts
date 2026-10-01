import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import type { ContentNavigationStrategyData } from '../../types/contentNavigationStrategy';
import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import type { GeneratorResult } from '../generators/types';
import type { CardFilter, FilterContext, FilterKind } from './types';

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
}

/**
 * The default curve. The default strategy doc carries it as its config, so
 * the admin pipeline view shows what runs.
 */
export const DEFAULT_ELO_DISTANCE_CONFIG: Required<EloDistanceConfig> = {
  halfLife: 300,
  minMultiplier: 0.05,
  maxMultiplier: 1.0,
};

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

async function applyEloDistance(
  cards: WeightedCard[],
  context: FilterContext,
  config: Required<EloDistanceConfig>,
  source: { name: string; strategyId: string }
): Promise<WeightedCard[]> {
  const { course, userElo } = context;
  const { halfLife, minMultiplier, maxMultiplier } = config;

  // Generators that know a card's ELO carry it; fetch the rest (reviews) in one batch.
  const missing = cards.filter((c) => c.cardElo === undefined).map((c) => c.cardId);
  const fetched = new Map<string, number>();
  if (missing.length > 0) {
    const elos = await course.getCardEloData(missing);
    missing.forEach((id, i) => fetched.set(id, elos[i]?.global?.score ?? DEFAULT_CARD_ELO));
  }

  return cards.map((card) => {
    const cardElo = card.cardElo ?? fetched.get(card.cardId) ?? DEFAULT_CARD_ELO;
    const distance = Math.abs(cardElo - userElo);
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
          reason: `ELO distance ${Math.round(distance)} (card: ${Math.round(cardElo)}, user: ${Math.round(userElo)}) → ${multiplier.toFixed(2)}x`,
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
