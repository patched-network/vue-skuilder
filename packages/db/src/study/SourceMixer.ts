import { WeightedCard } from '@db/core/navigators';

/**
 * Represents a batch of content fetched from a single StudyContentSource.
 */
export interface SourceBatch {
  sourceIndex: number;
  weighted: WeightedCard[];
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
 * Quota-based mixer with interleaved output.
 *
 * Allocates equal representation to each source (top-N by score), then
 * interleaves the results by dealing from a randomly-shuffled source order.
 * Within each source, cards are dealt in score-descending order.
 *
 * This ensures that cards from different courses are spread throughout the
 * queue rather than clustered by score bands, which matters because
 * SessionController consumes queues front-to-back and sessions often end
 * before reaching the tail.
 */
export class QuotaRoundRobinMixer implements SourceMixer {
  mix(batches: SourceBatch[], limit: number): WeightedCard[] {
    if (batches.length === 0) {
      return [];
    }

    const quotaPerSource = Math.ceil(limit / batches.length);

    // Build per-source stacks sorted by score descending, capped at quota
    const sourceStacks: WeightedCard[][] = batches.map((batch) => {
      return [...batch.weighted].sort((a, b) => b.score - a.score).slice(0, quotaPerSource);
    });

    // Shuffle the source ordering so no course is systematically first
    for (let i = sourceStacks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sourceStacks[i], sourceStacks[j]] = [sourceStacks[j], sourceStacks[i]];
    }

    // Interleave: deal one card from each source in rotation
    const result: WeightedCard[] = [];
    let exhausted = 0;
    const cursors = new Array(sourceStacks.length).fill(0);

    while (result.length < limit && exhausted < sourceStacks.length) {
      exhausted = 0;
      for (let s = 0; s < sourceStacks.length; s++) {
        if (result.length >= limit) break;

        if (cursors[s] < sourceStacks[s].length) {
          result.push(sourceStacks[s][cursors[s]]);
          cursors[s]++;
        } else {
          exhausted++;
        }
      }
    }

    return result;
  }
}
