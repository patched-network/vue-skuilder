import { WeightedCard } from '@db/core/navigators';
import { StudySessionReviewItem } from '@db/core';

/**
 * Represents a batch of content fetched from a single StudyContentSource.
 */
export interface SourceBatch {
  sourceIndex: number;
  weighted: WeightedCard[];
  reviews: StudySessionReviewItem[];
}

/**
 * Strategy interface for mixing content from multiple sources into a unified
 * set of weighted candidates.
 *
 * Different implementations can provide different balancing strategies:
 * - QuotaRoundRobinMixer: Equal representation per source
 * - MinMaxNormalizingMixer: Score normalization then global sort
 * - PercentileBucketMixer: Bucketed round-robin
 * etc.
 */
export interface SourceMixer {
  /**
   * Mix weighted cards from multiple sources into a unified, ordered list.
   *
   * @param batches - Content batches from each source
   * @param limit - Target number of cards to return
   * @returns Mixed and ordered weighted cards
   */
  mix(batches: SourceBatch[], limit: number): WeightedCard[];
}

/**
 * Simple quota-based mixer: allocates equal representation to each source,
 * taking the top-N cards by score from each.
 *
 * Guarantees balanced representation across sources regardless of absolute
 * score differences. A low-scoring source gets the same quota as a high-scoring
 * source.
 *
 * This is the KISS approach - simple, predictable, and fair in terms of
 * source representation (though not necessarily optimal in terms of absolute
 * card quality).
 */
export class QuotaRoundRobinMixer implements SourceMixer {
  mix(batches: SourceBatch[], limit: number): WeightedCard[] {
    if (batches.length === 0) {
      return [];
    }

    const quotaPerSource = Math.ceil(limit / batches.length);
    const mixed: WeightedCard[] = [];

    for (const batch of batches) {
      // Sort this source's cards by score descending
      const sortedBatch = [...batch.weighted].sort((a, b) => b.score - a.score);

      // Take top quotaPerSource from this source
      const topFromSource = sortedBatch.slice(0, quotaPerSource);
      mixed.push(...topFromSource);
    }

    // Sort the mixed result by score descending and return up to limit
    return mixed.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
