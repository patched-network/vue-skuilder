import type { WeightedCard } from './index';

// ============================================================================
// DIVERSITY RE-RANK  (pipeline stage 3)
// ============================================================================
//
// Generators produce candidates → filters weigh them → THIS stage diversifies
// the ranking. It demotes cards whose distinctive tags already appeared among
// higher-ranked candidates, so a single answer/concept can't monopolise the
// head of the queue (the "press `i` repeatedly" rut).
//
// ## Tag-agnostic by construction
//
// The framework has no first-class notion of an "answer" — tags are the only
// structured similarity signal it carries. This stage privileges NO tag: it
// hardcodes no namespace and works on whatever tags a course happens to apply.
// "Tag-agnostic" means "no tag is special," not "ignores tags": a course that
// never tags its sameness axis is invisible to the re-rank (acceptable — tags
// are the framework's content contract).
//
// ## Why rarity weighting (IDF)
//
// Naive "penalize by count of shared tags" is noisy: cards share lots of
// scaffolding tags (`ui:*`, incidental `gpc:expose:*`) that say nothing about
// sameness. We weight each shared tag by its rarity in the candidate pool
// (inverse document frequency). Ubiquitous tags contribute ~0; the distinctive
// tag a cluster shares — exactly what makes a rut a rut — dominates. This is
// self-tuning and needs no per-course configuration: a math course clustering
// on "answer = 7" or a music course on "interval = M3" gets the same benefit
// for free, provided that axis is tagged.
//
// ## Algorithm — greedy maximal-marginal-relevance
//
//   1. df[tag] = #cards carrying tag;  idf[tag] = ln(N / df[tag])
//      (tag in every card → idf 0; rarer → larger).
//   2. Walk candidates in score order, emitting one at a time. Track how many
//      already-emitted cards carry each tag (`emittedCount`).
//   3. A candidate's repetition load = Σ_{t ∈ card.tags} idf[t]·emittedCount[t].
//      penalty = max(floor, 1 / (1 + strength·load)).
//   4. Each step emit argmax(score·penalty); freeze that penalised score.
//
// Because each step picks the current maximum and selecting a card only lowers
// (never raises) the remaining cards' values, the frozen scores are
// monotonically non-increasing in pick order — so a subsequent sort-by-score
// (the Pipeline's, and the SourceMixer's) reproduces this exact order. This is
// why the stage expresses itself as SCORE penalties rather than a bare array
// reorder: a positional shuffle would be silently undone by the mixer's
// score-descending re-sort.
//
// ============================================================================

export interface DiversityRerankOptions {
  /**
   * How hard repetition is penalised. Larger → steeper demotion of repeated
   * distinctive tags. Penalty = 1 / (1 + strength·load).
   */
  strength?: number;
  /**
   * Minimum penalty multiplier. A card is never demoted below `floor × score`,
   * however much it repeats. Keeps a strong-but-repeated card from being driven
   * under downstream "well-indicated" thresholds (which would mislabel it as
   * filler and could trigger spurious quality-replans). Tunes "perturb ordering"
   * vs "annihilate candidates."
   */
  floor?: number;
}

/** Default repetition strength. See DiversityRerankOptions.strength. */
export const DIVERSITY_STRENGTH = 0.6;

/** Default penalty floor. See DiversityRerankOptions.floor. */
export const DIVERSITY_FLOOR = 0.3;

const STRATEGY = 'diversityRerank';
const STRATEGY_ID = 'DIVERSITY_RERANK';
const STRATEGY_NAME = 'Diversity Re-rank';

/**
 * Re-rank a scored candidate pool for answer/concept variety.
 *
 * Pure: returns a new array (diversified order, adjusted scores, appended
 * provenance) and does not mutate the input cards. Cards entering are assumed
 * to have score > 0 (the Pipeline strips zero-score cards before this stage).
 * Non-finite scores (mandatory `requireCards`, score = +Infinity) are emitted
 * untouched and still count toward repetition for later cards.
 *
 * @param cards - Post-filter, post-hint candidates.
 * @param opts  - Optional strength/floor overrides (defaults are sane and
 *                course-general; promote to strategy config if you ever want
 *                this learnable under the orchestration layer).
 * @returns Cards in diversified order with penalised scores.
 */
export function diversityRerank(
  cards: WeightedCard[],
  opts: DiversityRerankOptions = {}
): WeightedCard[] {
  const strength = opts.strength ?? DIVERSITY_STRENGTH;
  const floor = opts.floor ?? DIVERSITY_FLOOR;

  const n = cards.length;
  if (n <= 1) return cards;

  // 1. Document frequency → IDF. A tag in every card carries no discriminative
  //    signal (idf 0); a rare tag dominates the repetition load.
  const df = new Map<string, number>();
  for (const card of cards) {
    for (const tag of card.tags ?? []) {
      df.set(tag, (df.get(tag) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [tag, freq] of df) {
    idf.set(tag, Math.log(n / freq));
  }

  // 2-4. Greedy MMR. `remaining` holds candidates not yet emitted; `emitted`
  //      counts selected cards per tag.
  const remaining = [...cards];
  const emittedCount = new Map<string, number>();
  const out: WeightedCard[] = [];

  const repetitionLoad = (card: WeightedCard): number => {
    let load = 0;
    for (const tag of card.tags ?? []) {
      const seen = emittedCount.get(tag);
      if (seen) load += (idf.get(tag) ?? 0) * seen;
    }
    return load;
  };

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestValue = -Infinity;
    let bestPenalty = 1;
    let bestLoad = 0;

    for (let i = 0; i < remaining.length; i++) {
      const card = remaining[i];
      const load = repetitionLoad(card);
      const penalty = load > 0 ? Math.max(floor, 1 / (1 + strength * load)) : 1;
      // Non-finite (mandatory) scores stay non-finite: Infinity × penalty =
      // Infinity, so they argmax first and ride through unchanged.
      const value = card.score * penalty;
      // Strict ">" keeps the scan stable: ties resolve to the earlier (already
      // higher-ranked-by-incoming-score) card.
      if (value > bestValue) {
        bestValue = value;
        bestIdx = i;
        bestPenalty = penalty;
        bestLoad = load;
      }
    }

    const [picked] = remaining.splice(bestIdx, 1);

    if (Number.isFinite(picked.score) && bestPenalty < 1) {
      const newScore = picked.score * bestPenalty;
      out.push({
        ...picked,
        score: newScore,
        provenance: [
          ...picked.provenance,
          {
            strategy: STRATEGY,
            strategyId: STRATEGY_ID,
            strategyName: STRATEGY_NAME,
            action: 'penalized',
            score: newScore,
            reason: `repeated tags (load ${bestLoad.toFixed(2)}) → ×${bestPenalty.toFixed(2)}`,
          },
        ],
      });
    } else {
      // No penalty (fresh card, or mandatory/non-finite): emit untouched but
      // still let it count toward later cards' repetition load below.
      out.push(picked);
    }

    for (const tag of picked.tags ?? []) {
      emittedCount.set(tag, (emittedCount.get(tag) ?? 0) + 1);
    }
  }

  return out;
}
