import { ContentNavigator } from './index';
import type { WeightedCard } from './index';
import type { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import type { CourseDBInterface } from '../interfaces/courseDB';
import type { UserDBInterface } from '../interfaces/userDB';
import type { CardGenerator, GeneratorContext } from './generators/types';
import { logger } from '../../util/logger';

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

    // Group by cardId
    const byCardId = new Map<string, WeightedCard[]>();
    for (const cards of results) {
      for (const card of cards) {
        const existing = byCardId.get(card.cardId) || [];
        existing.push(card);
        byCardId.set(card.cardId, existing);
      }
    }

    // Aggregate scores
    const merged: WeightedCard[] = [];
    for (const [, cards] of byCardId) {
      const aggregatedScore = this.aggregateScores(cards);
      const finalScore = Math.min(1.0, aggregatedScore); // Clamp to [0, 1]

      // Merge provenance from all generators that produced this card
      const mergedProvenance = cards.flatMap((c) => c.provenance);

      // Determine action based on whether score changed
      const initialScore = cards[0].score;
      const action =
        finalScore > initialScore ? 'boosted' : finalScore < initialScore ? 'penalized' : 'passed';

      // Build reason explaining the aggregation
      const reason = this.buildAggregationReason(cards, finalScore);

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
  private buildAggregationReason(cards: WeightedCard[], finalScore: number): string {
    const count = cards.length;
    const scores = cards.map((c) => c.score.toFixed(2)).join(', ');

    if (count === 1) {
      return `Single generator, score ${finalScore.toFixed(2)}`;
    }

    const strategies = cards.map((c) => c.provenance[0]?.strategy || 'unknown').join(', ');

    switch (this.aggregationMode) {
      case AggregationMode.MAX:
        return `Max of ${count} generators (${strategies}): scores [${scores}] → ${finalScore.toFixed(2)}`;

      case AggregationMode.AVERAGE:
        return `Average of ${count} generators (${strategies}): scores [${scores}] → ${finalScore.toFixed(2)}`;

      case AggregationMode.FREQUENCY_BOOST: {
        const avg = cards.reduce((sum, c) => sum + c.score, 0) / count;
        const boost = 1 + FREQUENCY_BOOST_FACTOR * (count - 1);
        return `Frequency boost from ${count} generators (${strategies}): avg ${avg.toFixed(2)} × ${boost.toFixed(2)} → ${finalScore.toFixed(2)}`;
      }

      default:
        return `Aggregated from ${count} generators: ${finalScore.toFixed(2)}`;
    }
  }

  /**
   * Aggregate scores from multiple generators for the same card.
   */
  private aggregateScores(cards: WeightedCard[]): number {
    const scores = cards.map((c) => c.score);

    switch (this.aggregationMode) {
      case AggregationMode.MAX:
        return Math.max(...scores);

      case AggregationMode.AVERAGE:
        return scores.reduce((sum, s) => sum + s, 0) / scores.length;

      case AggregationMode.FREQUENCY_BOOST: {
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const frequencyBoost = 1 + FREQUENCY_BOOST_FACTOR * (cards.length - 1);
        return avg * frequencyBoost;
      }

      default:
        return scores[0];
    }
  }
}
