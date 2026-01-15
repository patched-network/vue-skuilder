import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import type { ContentNavigationStrategyData } from '../../types/contentNavigationStrategy';
import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import type { CardGenerator, GeneratorContext } from './types';
import { logger } from '../../../util/logger';

// ============================================================================
// COMPOSITE GENERATOR
// ============================================================================
//
// Composes multiple generator strategies into a single generator.
//
// Use case: When a course has multiple generators (e.g., ELO + SRS), this
// class merges their outputs into a unified candidate list.
//
// Aggregation strategy:
// - Cards appearing in multiple generators get a frequency boost
// - Score = average(scores) * (1 + 0.1 * (appearances - 1))
// - This rewards cards that multiple generators agree on
//
// ============================================================================

/**
 * Aggregation modes for combining scores from multiple generators.
 */
export enum AggregationMode {
  /** Use the maximum score from any generator */
  MAX = 'max',
  /** Average all scores */
  AVERAGE = 'average',
  /** Average with frequency boost: avg * (1 + 0.1 * (n-1)) */
  FREQUENCY_BOOST = 'frequencyBoost',
}

const DEFAULT_AGGREGATION_MODE = AggregationMode.FREQUENCY_BOOST;
const FREQUENCY_BOOST_FACTOR = 0.1;

/**
 * Composes multiple generators into a single generator.
 *
 * Implements CardGenerator for use in Pipeline architecture.
 * Also extends ContentNavigator for backward compatibility.
 *
 * Fetches candidates from all generators, deduplicates by cardId,
 * and aggregates scores based on the configured mode.
 */
export default class CompositeGenerator extends ContentNavigator implements CardGenerator {
  /** Human-readable name for CardGenerator interface */
  name: string = 'Composite Generator';

  private generators: CardGenerator[];
  private aggregationMode: AggregationMode;

  constructor(
    generators: CardGenerator[],
    aggregationMode: AggregationMode = DEFAULT_AGGREGATION_MODE
  ) {
    super();
    this.generators = generators;
    this.aggregationMode = aggregationMode;

    if (generators.length === 0) {
      throw new Error('CompositeGenerator requires at least one generator');
    }

    logger.debug(
      `[CompositeGenerator] Created with ${generators.length} generators, mode: ${aggregationMode}`
    );
  }

  /**
   * Creates a CompositeGenerator from strategy data.
   *
   * This is a convenience factory for use by PipelineAssembler.
   */
  static async fromStrategies(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategies: ContentNavigationStrategyData[],
    aggregationMode: AggregationMode = DEFAULT_AGGREGATION_MODE
  ): Promise<CompositeGenerator> {
    const generators = await Promise.all(
      strategies.map((s) => ContentNavigator.create(user, course, s))
    );
    // Cast is safe because we know these are generators
    return new CompositeGenerator(generators as unknown as CardGenerator[], aggregationMode);
  }

  /**
   * Get weighted cards from all generators, merge and deduplicate.
   *
   * Cards appearing in multiple generators receive a score boost.
   * Provenance tracks which generators produced each card and how scores were aggregated.
   *
   * This method supports both the legacy signature (limit only) and the
   * CardGenerator interface signature (limit, context).
   *
   * @param limit - Maximum number of cards to return
   * @param context - GeneratorContext passed to child generators (required when called via Pipeline)
   */
  async getWeightedCards(limit: number, context?: GeneratorContext): Promise<WeightedCard[]> {
    if (!context) {
      throw new Error(
        'CompositeGenerator.getWeightedCards requires a GeneratorContext. ' +
          'It should be called via Pipeline, not directly.'
      );
    }

    // Fetch from all generators in parallel
    const results = await Promise.all(
      this.generators.map((g) => g.getWeightedCards(limit, context))
    );

    // Log per-generator breakdown for transparency
    const generatorSummaries: string[] = [];
    results.forEach((cards, index) => {
      const gen = this.generators[index];
      const genName = gen.name || `Generator ${index}`;
      const newCards = cards.filter((c) => c.provenance[0]?.reason?.includes('new card'));
      const reviewCards = cards.filter((c) => c.provenance[0]?.reason?.includes('review'));
      
      if (cards.length > 0) {
        const topScore = Math.max(...cards.map((c) => c.score)).toFixed(2);
        const parts: string[] = [];
        if (newCards.length > 0) parts.push(`${newCards.length} new`);
        if (reviewCards.length > 0) parts.push(`${reviewCards.length} reviews`);
        const breakdown = parts.length > 0 ? parts.join(', ') : `${cards.length} cards`;
        generatorSummaries.push(`${genName}: ${breakdown} (top: ${topScore})`);
      } else {
        generatorSummaries.push(`${genName}: 0 cards`);
      }
    });
    logger.info(`[Composite] Generator breakdown: ${generatorSummaries.join(' | ')}`);

    // Group by cardId, tracking the weight of the generator that produced each instance
    type WeightedResult = { card: WeightedCard; weight: number };
    const byCardId = new Map<string, WeightedResult[]>();

    results.forEach((cards, index) => {
      // Access learnable weight if available
      const gen = this.generators[index] as unknown as ContentNavigator;

      // Determine effective weight
      let weight = gen.learnable?.weight ?? 1.0;
      let deviation: number | undefined;

      if (gen.learnable && !gen.staticWeight && context.orchestration) {
        // Access strategyId (protected field) via type assertion
        const strategyId = (gen as any).strategyId;
        if (strategyId) {
          weight = context.orchestration.getEffectiveWeight(strategyId, gen.learnable);
          deviation = context.orchestration.getDeviation(strategyId);
        }
      }

      for (const card of cards) {
        // Record effective weight in provenance for transparency
        if (card.provenance.length > 0) {
          card.provenance[0].effectiveWeight = weight;
          card.provenance[0].deviation = deviation;
        }

        const existing = byCardId.get(card.cardId) || [];
        existing.push({ card, weight });
        byCardId.set(card.cardId, existing);
      }
    });

    // Aggregate scores
    const merged: WeightedCard[] = [];
    for (const [, items] of byCardId) {
      const cards = items.map((i) => i.card);
      const aggregatedScore = this.aggregateScores(items);
      const finalScore = Math.min(1.0, aggregatedScore); // Clamp to [0, 1]

      // Merge provenance from all generators that produced this card
      const mergedProvenance = cards.flatMap((c) => c.provenance);

      // Determine action based on whether score changed
      const initialScore = cards[0].score;
      const action =
        finalScore > initialScore ? 'boosted' : finalScore < initialScore ? 'penalized' : 'passed';

      // Build reason explaining the aggregation
      const reason = this.buildAggregationReason(items, finalScore);

      // Append composite provenance entry
      merged.push({
        ...cards[0],
        score: finalScore,
        provenance: [
          ...mergedProvenance,
          {
            strategy: 'composite',
            strategyName: 'Composite Generator',
            strategyId: 'COMPOSITE_GENERATOR',
            action,
            score: finalScore,
            reason,
          },
        ],
      });
    }

    // Sort by score descending and limit
    return merged.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Build human-readable reason for score aggregation.
   */
  private buildAggregationReason(
    items: { card: WeightedCard; weight: number }[],
    finalScore: number
  ): string {
    const cards = items.map((i) => i.card);
    const count = cards.length;
    const scores = cards.map((c) => c.score.toFixed(2)).join(', ');

    if (count === 1) {
      const weightMsg =
        Math.abs(items[0].weight - 1.0) > 0.001 ? ` (w=${items[0].weight.toFixed(2)})` : '';
      return `Single generator, score ${finalScore.toFixed(2)}${weightMsg}`;
    }

    const strategies = cards.map((c) => c.provenance[0]?.strategy || 'unknown').join(', ');

    switch (this.aggregationMode) {
      case AggregationMode.MAX:
        return `Max of ${count} generators (${strategies}): scores [${scores}] → ${finalScore.toFixed(2)}`;

      case AggregationMode.AVERAGE:
        return `Weighted Avg of ${count} generators (${strategies}): scores [${scores}] → ${finalScore.toFixed(2)}`;

      case AggregationMode.FREQUENCY_BOOST: {
        // Recalculate basic weighted avg for display
        const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
        const weightedSum = items.reduce((sum, i) => sum + i.card.score * i.weight, 0);
        const avg = totalWeight > 0 ? weightedSum / totalWeight : 0;

        const boost = 1 + FREQUENCY_BOOST_FACTOR * (count - 1);
        return `Frequency boost from ${count} generators (${strategies}): w-avg ${avg.toFixed(2)} × ${boost.toFixed(2)} → ${finalScore.toFixed(2)}`;
      }

      default:
        return `Aggregated from ${count} generators: ${finalScore.toFixed(2)}`;
    }
  }

  /**
   * Aggregate scores from multiple generators for the same card.
   */
  private aggregateScores(items: { card: WeightedCard; weight: number }[]): number {
    const scores = items.map((i) => i.card.score);

    switch (this.aggregationMode) {
      case AggregationMode.MAX:
        return Math.max(...scores);

      case AggregationMode.AVERAGE: {
        const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
        if (totalWeight === 0) return 0;
        const weightedSum = items.reduce((sum, i) => sum + i.card.score * i.weight, 0);
        return weightedSum / totalWeight;
      }

      case AggregationMode.FREQUENCY_BOOST: {
        const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
        const weightedSum = items.reduce((sum, i) => sum + i.card.score * i.weight, 0);
        const avg = totalWeight > 0 ? weightedSum / totalWeight : 0;

        const frequencyBoost = 1 + FREQUENCY_BOOST_FACTOR * (items.length - 1);
        return avg * frequencyBoost;
      }

      default:
        return scores[0];
    }
  }
}
