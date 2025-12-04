import type { WeightedCard } from '../index';
import type { CardFilter, FilterContext } from './types';

// ============================================================================
// ELO DISTANCE FILTER
// ============================================================================
//
// Penalizes cards that are far from the user's current ELO using a smooth curve.
//
// This filter addresses cross-strategy coordination:
// - SRS generates reviews based on scheduling
// - But some scheduled cards may be "below" the user's current level
// - Or "above" (shouldn't happen often, but possible)
//
// By applying ELO distance penalties, we can:
// - Deprioritize reviews the user has "moved beyond"
// - Deprioritize cards that are too hard for current skill level
//
// The penalty curve is smooth (no discontinuities) using a Gaussian-like decay.
//
// ============================================================================

/**
 * Configuration for the ELO distance filter.
 */
export interface EloDistanceConfig {
  /**
   * The ELO distance at which the multiplier is ~0.6 (one standard deviation).
   * Default: 200 ELO points.
   *
   * - At distance 0: multiplier ≈ 1.0
   * - At distance = halfLife: multiplier ≈ 0.6
   * - At distance = 2 * halfLife: multiplier ≈ 0.37
   * - At distance = 3 * halfLife: multiplier ≈ 0.22
   */
  halfLife?: number;

  /**
   * Minimum multiplier (floor) to prevent scores from going too low.
   * Default: 0.3
   */
  minMultiplier?: number;

  /**
   * Maximum multiplier (ceiling). Usually 1.0 (no boost for close cards).
   * Default: 1.0
   */
  maxMultiplier?: number;
}

const DEFAULT_HALF_LIFE = 200;
const DEFAULT_MIN_MULTIPLIER = 0.3;
const DEFAULT_MAX_MULTIPLIER = 1.0;

/**
 * Compute the multiplier for a given ELO distance using Gaussian decay.
 *
 * Formula: minMultiplier + (maxMultiplier - minMultiplier) * exp(-(distance/halfLife)^2)
 *
 * This produces a smooth bell curve centered at distance=0:
 * - At distance 0: multiplier = maxMultiplier (1.0)
 * - As distance increases: multiplier smoothly decays toward minMultiplier
 * - No discontinuities or sudden jumps
 */
function computeMultiplier(
  distance: number,
  halfLife: number,
  minMultiplier: number,
  maxMultiplier: number
): number {
  // Gaussian decay: exp(-(d/h)^2)
  const normalizedDistance = distance / halfLife;
  const decay = Math.exp(-(normalizedDistance * normalizedDistance));

  // Scale between min and max
  return minMultiplier + (maxMultiplier - minMultiplier) * decay;
}

/**
 * Create an ELO distance filter.
 *
 * Penalizes cards that are far from the user's current ELO level
 * using a smooth Gaussian decay curve. No discontinuities.
 *
 * @param config - Optional configuration for the decay curve
 * @returns A CardFilter that applies ELO distance penalties
 */
export function createEloDistanceFilter(config?: EloDistanceConfig): CardFilter {
  const halfLife = config?.halfLife ?? DEFAULT_HALF_LIFE;
  const minMultiplier = config?.minMultiplier ?? DEFAULT_MIN_MULTIPLIER;
  const maxMultiplier = config?.maxMultiplier ?? DEFAULT_MAX_MULTIPLIER;

  return {
    name: 'ELO Distance Filter',

    async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
      const { course, userElo } = context;

      // Batch fetch ELO data for all cards
      const cardIds = cards.map((c) => c.cardId);
      const cardElos = await course.getCardEloData(cardIds);

      return cards.map((card, i) => {
        const cardElo = cardElos[i]?.global?.score ?? 1000;
        const distance = Math.abs(cardElo - userElo);
        const multiplier = computeMultiplier(distance, halfLife, minMultiplier, maxMultiplier);
        const newScore = card.score * multiplier;

        const action = multiplier < maxMultiplier - 0.01 ? 'penalized' : 'passed';

        return {
          ...card,
          score: newScore,
          provenance: [
            ...card.provenance,
            {
              strategy: 'eloDistance',
              strategyName: 'ELO Distance Filter',
              strategyId: 'ELO_DISTANCE_FILTER',
              action,
              score: newScore,
              reason: `ELO distance ${Math.round(distance)} (card: ${Math.round(cardElo)}, user: ${Math.round(userElo)}) → ${multiplier.toFixed(2)}x`,
            },
          ],
        };
      });
    },
  };
}

// Export defaults for testing
export { DEFAULT_HALF_LIFE, DEFAULT_MIN_MULTIPLIER, DEFAULT_MAX_MULTIPLIER };
