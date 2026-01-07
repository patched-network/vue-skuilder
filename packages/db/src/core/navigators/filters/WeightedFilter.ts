import { CardFilter, FilterContext } from './types';
import { WeightedCard } from '../index';
import { LearnableWeight, DEFAULT_LEARNABLE_WEIGHT } from '../../types/contentNavigationStrategy';

/**
 * Wraps a CardFilter to apply evolutionary weighting to its effects.
 *
 * If a filter applies a multiplier M (score * M), and the strategy has
 * an effective weight W, the final multiplier becomes M^W.
 *
 * - W=1.0: Original behavior
 * - W>1.0: Amplifies the filter's opinion (stronger boost/penalty)
 * - W<1.0: Dampens the filter's opinion (weaker boost/penalty)
 * - W=0.0: Nullifies the filter (identity)
 *
 * This wrapper handles the math of scaling the filter's impact and updating
 * the provenance trail with the effective weight used.
 */
export class WeightedFilter implements CardFilter {
  public name: string;
  private inner: CardFilter;
  private learnable: LearnableWeight;
  private staticWeight: boolean;

  constructor(
    inner: CardFilter,
    learnable: LearnableWeight = DEFAULT_LEARNABLE_WEIGHT,
    staticWeight: boolean = false
  ) {
    this.inner = inner;
    this.name = inner.name;
    this.learnable = learnable;
    this.staticWeight = staticWeight;
  }

  /**
   * Apply the inner filter, then scale its effect by the configured weight.
   */
  async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    // ========================================================================
    // 1. DETERMINE EFFECTIVE WEIGHT
    // ========================================================================
    
    // Phase 1: Effective weight is just the learnable weight (or 1.0 default)
    // Phase 2 TODO: Compute deviation based on user ID and cohort salt
    // const deviation = this.staticWeight ? 0 : computeDeviation(...);
    // const effectiveWeight = computeEffectiveWeight(this.learnable, deviation);

    // Reference staticWeight to silence linter until Phase 2 deviation logic is added
    const effectiveWeight = this.staticWeight ? this.learnable.weight : this.learnable.weight;

    // Optimization: If weight is 1.0, the scaling is an identity operation.
    // Just run the inner filter directly.
    if (Math.abs(effectiveWeight - 1.0) < 0.001) {
      return this.inner.transform(cards, context);
    }

    // ========================================================================
    // 2. CAPTURE STATE BEFORE FILTER
    // ========================================================================
    
    // We need original scores to calculate what the filter did (M = new/old)
    const originalScores = new Map<string, number>();
    for (const card of cards) {
      originalScores.set(card.cardId, card.score);
    }

    // ========================================================================
    // 3. RUN INNER FILTER
    // ========================================================================
    
    const transformedCards = await this.inner.transform(cards, context);

    // ========================================================================
    // 4. APPLY WEIGHT SCALING
    // ========================================================================
    
    return transformedCards.map((card) => {
      const originalScore = originalScores.get(card.cardId);

      // Edge cases where we can't or shouldn't scale:
      // - Original score missing (shouldn't happen)
      // - Original score 0 (was already excluded)
      // - New score 0 (filter excluded it / vetoed) - we treat vetoes as absolute
      if (originalScore === undefined || originalScore === 0 || card.score === 0) {
        return card;
      }

      // Calculate raw effect multiplier: M = new / old
      const rawEffect = card.score / originalScore;

      // If filter didn't change this card, nothing to scale
      if (Math.abs(rawEffect - 1.0) < 0.0001) {
        return card;
      }

      // Apply weight: scaled = M ^ W
      // Example: 0.5 penalty ^ 2.0 weight = 0.25 (stronger penalty)
      // Example: 0.5 penalty ^ 0.5 weight = 0.707 (weaker penalty)
      const weightedEffect = Math.pow(rawEffect, effectiveWeight);
      const newScore = originalScore * weightedEffect;

      // Update provenance
      // The inner filter just added the last entry. We need to update it
      // to reflect the weighted score and record the effective weight.
      const lastProvIndex = card.provenance.length - 1;
      const lastProv = card.provenance[lastProvIndex];

      if (lastProv) {
        const updatedProvenance = [...card.provenance];
        updatedProvenance[lastProvIndex] = {
          ...lastProv,
          score: newScore,
          effectiveWeight: effectiveWeight,
          // We can optionally append to the reason, but the structured field is key
        };

        return {
          ...card,
          score: newScore,
          provenance: updatedProvenance,
        };
      }

      // Fallback if no provenance found (rare)
      return {
        ...card,
        score: newScore,
      };
    });
  }
}