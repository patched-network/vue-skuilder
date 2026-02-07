import type { WeightedCard } from '@db/core/navigators';
import type { SourceBatch } from './SourceMixer';
import { logger } from '../util/logger';
import { getCardOrigin } from '@db/core/navigators';

// ============================================================================
// MIXER DEBUGGER
// ============================================================================
//
// Console-accessible debug API for inspecting cross-source mixing decisions.
//
// Exposed as `window.skuilder.mixer` for interactive exploration.
//
// Usage:
//   window.skuilder.mixer.showLastMix()
//   window.skuilder.mixer.explainSourceBalance()
//   window.skuilder.mixer.showCard('cardId123')
//   window.skuilder.mixer.compareScores()
//   window.skuilder.mixer.export()
//
// ============================================================================

/**
 * Summary of a single source's contribution to the mix.
 */
export interface SourceSummary {
  sourceIndex: number;
  sourceId: string;
  sourceName?: string;
  totalCards: number;
  reviewCount: number;
  newCount: number;
  topScore: number;
  bottomScore: number;
  scoreRange: [number, number];
  avgScore: number;
}

/**
 * Per-source selection breakdown.
 */
export interface SourceSelectionBreakdown {
  sourceId: string;
  sourceName?: string;
  reviewsProvided: number;
  newProvided: number;
  reviewsSelected: number;
  newSelected: number;
  totalSelected: number;
  selectionRate: number; // percentage
}

/**
 * Detailed card information in the mixer context.
 */
export interface MixerCardInfo {
  cardId: string;
  courseId: string;
  origin: 'review' | 'new' | 'unknown';
  score: number;
  sourceIndex: number;
  selected: boolean;
  rankInSource?: number; // 1-indexed position within its source batch
  rankInMix?: number; // 1-indexed position in final mixed results
}

/**
 * Complete record of a single mixer execution.
 */
export interface MixerRunReport {
  runId: string;
  timestamp: Date;

  // Mixer configuration
  mixerType: string;
  requestedLimit: number;
  quotaPerSource?: number;

  // Input batches
  sourceSummaries: SourceSummary[];

  // Selection results
  cards: MixerCardInfo[];
  finalCount: number;
  reviewsSelected: number;
  newSelected: number;

  // Per-source breakdown
  sourceBreakdowns: SourceSelectionBreakdown[];
}

/**
 * Ring buffer for storing recent mixer runs.
 */
const MAX_RUNS = 10;
const runHistory: MixerRunReport[] = [];

/**
 * Build source summary from a batch.
 */
function buildSourceSummary(batch: SourceBatch, sourceId: string, sourceName?: string): SourceSummary {
  const scores = batch.weighted.map((c) => c.score);
  const reviewCount = batch.weighted.filter((c) => getCardOrigin(c) === 'review').length;
  const newCount = batch.weighted.filter((c) => getCardOrigin(c) === 'new').length;

  return {
    sourceIndex: batch.sourceIndex,
    sourceId,
    sourceName,
    totalCards: batch.weighted.length,
    reviewCount,
    newCount,
    topScore: scores.length > 0 ? Math.max(...scores) : 0,
    bottomScore: scores.length > 0 ? Math.min(...scores) : 0,
    scoreRange: scores.length > 0 ? [Math.min(...scores), Math.max(...scores)] : [0, 0],
    avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
  };
}

/**
 * Build source selection breakdown.
 */
function buildSourceBreakdown(
  sourceId: string,
  sourceName: string | undefined,
  allCards: MixerCardInfo[]
): SourceSelectionBreakdown {
  const sourceCards = allCards.filter((c) => c.courseId === sourceId);
  const selectedCards = sourceCards.filter((c) => c.selected);

  const reviewsProvided = sourceCards.filter((c) => c.origin === 'review').length;
  const newProvided = sourceCards.filter((c) => c.origin === 'new').length;
  const reviewsSelected = selectedCards.filter((c) => c.origin === 'review').length;
  const newSelected = selectedCards.filter((c) => c.origin === 'new').length;

  return {
    sourceId,
    sourceName,
    reviewsProvided,
    newProvided,
    reviewsSelected,
    newSelected,
    totalSelected: selectedCards.length,
    selectionRate: sourceCards.length > 0 ? (selectedCards.length / sourceCards.length) * 100 : 0,
  };
}

/**
 * Capture a mixer run for later inspection.
 */
export function captureMixerRun(
  mixerType: string,
  batches: SourceBatch[],
  sourceIds: string[],
  sourceNames: (string | undefined)[],
  requestedLimit: number,
  quotaPerSource: number | undefined,
  mixedResult: WeightedCard[]
): void {
  // Build source summaries
  const sourceSummaries = batches.map((batch, idx) =>
    buildSourceSummary(batch, sourceIds[idx] || `source-${idx}`, sourceNames[idx])
  );

  // Build card info with rankings
  const selectedIds = new Set(mixedResult.map((c) => c.cardId));

  // Rank cards within their source batches
  const sourceRankings = new Map<string, Map<string, number>>();
  batches.forEach((batch) => {
    const sorted = [...batch.weighted].sort((a, b) => b.score - a.score);
    const rankings = new Map<string, number>();
    sorted.forEach((card, idx) => {
      rankings.set(card.cardId, idx + 1);
    });
    sourceRankings.set(sourceIds[batch.sourceIndex] || `source-${batch.sourceIndex}`, rankings);
  });

  // Rank cards in final mix
  const mixRankings = new Map<string, number>();
  mixedResult.forEach((card, idx) => {
    mixRankings.set(card.cardId, idx + 1);
  });

  // Build all card info
  const allCardsMap = new Map<string, WeightedCard>();
  batches.forEach((batch) => {
    batch.weighted.forEach((card) => {
      allCardsMap.set(card.cardId, card);
    });
  });

  const cards: MixerCardInfo[] = Array.from(allCardsMap.values()).map((card) => ({
    cardId: card.cardId,
    courseId: card.courseId,
    origin: getCardOrigin(card),
    score: card.score,
    sourceIndex: batches.findIndex((b) => b.weighted.some((c) => c.cardId === card.cardId)),
    selected: selectedIds.has(card.cardId),
    rankInSource: sourceRankings.get(card.courseId)?.get(card.cardId),
    rankInMix: mixRankings.get(card.cardId),
  }));

  // Build per-source breakdowns
  const uniqueSourceIds = Array.from(new Set(sourceIds.filter((id) => id)));
  const sourceBreakdowns = uniqueSourceIds.map((sourceId, idx) =>
    buildSourceBreakdown(sourceId, sourceNames[idx], cards)
  );

  const report: MixerRunReport = {
    runId: `mix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    mixerType,
    requestedLimit,
    quotaPerSource,
    sourceSummaries,
    cards,
    finalCount: mixedResult.length,
    reviewsSelected: mixedResult.filter((c) => getCardOrigin(c) === 'review').length,
    newSelected: mixedResult.filter((c) => getCardOrigin(c) === 'new').length,
    sourceBreakdowns,
  };

  runHistory.unshift(report);
  if (runHistory.length > MAX_RUNS) {
    runHistory.pop();
  }
}

// ============================================================================
// CONSOLE API
// ============================================================================

/**
 * Print summary of a single mixer run.
 */
function printMixerSummary(run: MixerRunReport): void {
  // eslint-disable-next-line no-console
  console.group(`🎨 Mixer Run: ${run.mixerType}`);
  logger.info(`Run ID: ${run.runId}`);
  logger.info(`Time: ${run.timestamp.toISOString()}`);
  logger.info(
    `Config: limit=${run.requestedLimit}${run.quotaPerSource ? `, quota/source=${run.quotaPerSource}` : ''}`
  );

  // eslint-disable-next-line no-console
  console.group(`📥 Input: ${run.sourceSummaries.length} sources`);
  for (const src of run.sourceSummaries) {
    logger.info(
      `  ${src.sourceName || src.sourceId}: ${src.totalCards} cards (${src.reviewCount} reviews, ${src.newCount} new)`
    );
    logger.info(`    Score range: [${src.scoreRange[0].toFixed(2)}, ${src.scoreRange[1].toFixed(2)}], avg: ${src.avgScore.toFixed(2)}`);
  }
  // eslint-disable-next-line no-console
  console.groupEnd();

  // eslint-disable-next-line no-console
  console.group(`📤 Output: ${run.finalCount} cards selected (${run.reviewsSelected} reviews, ${run.newSelected} new)`);
  for (const breakdown of run.sourceBreakdowns) {
    const name = breakdown.sourceName || breakdown.sourceId;
    logger.info(
      `  ${name}: ${breakdown.totalSelected} selected (${breakdown.reviewsSelected} reviews, ${breakdown.newSelected} new) - ${breakdown.selectionRate.toFixed(1)}% selection rate`
    );
  }
  // eslint-disable-next-line no-console
  console.groupEnd();

  // eslint-disable-next-line no-console
  console.groupEnd();
}

/**
 * Console API object exposed on window.skuilder.mixer
 */
export const mixerDebugAPI = {
  /**
   * Get raw run history for programmatic access.
   */
  get runs(): MixerRunReport[] {
    return [...runHistory];
  },

  /**
   * Show summary of a specific mixer run.
   */
  showRun(idOrIndex: string | number = 0): void {
    if (runHistory.length === 0) {
      logger.info('[Mixer Debug] No runs captured yet.');
      return;
    }

    let run: MixerRunReport | undefined;

    if (typeof idOrIndex === 'number') {
      run = runHistory[idOrIndex];
      if (!run) {
        logger.info(`[Mixer Debug] No run found at index ${idOrIndex}. History length: ${runHistory.length}`);
        return;
      }
    } else {
      run = runHistory.find((r) => r.runId.endsWith(idOrIndex));
      if (!run) {
        logger.info(`[Mixer Debug] No run found matching ID '${idOrIndex}'.`);
        return;
      }
    }

    printMixerSummary(run);
  },

  /**
   * Show summary of the last mixer run.
   */
  showLastMix(): void {
    this.showRun(0);
  },

  /**
   * Explain source balance in the last run.
   */
  explainSourceBalance(): void {
    if (runHistory.length === 0) {
      logger.info('[Mixer Debug] No runs captured yet.');
      return;
    }

    const run = runHistory[0];

    // eslint-disable-next-line no-console
    console.group('⚖️ Source Balance Analysis');

    logger.info(`Mixer: ${run.mixerType}`);
    logger.info(`Requested limit: ${run.requestedLimit}`);
    if (run.quotaPerSource) {
      logger.info(`Quota per source: ${run.quotaPerSource}`);
    }

    // eslint-disable-next-line no-console
    console.group('Input Distribution:');
    for (const src of run.sourceSummaries) {
      const name = src.sourceName || src.sourceId;
      logger.info(`${name}:`);
      logger.info(`  Provided: ${src.totalCards} cards (${src.reviewCount} reviews, ${src.newCount} new)`);
      logger.info(`  Score range: [${src.scoreRange[0].toFixed(2)}, ${src.scoreRange[1].toFixed(2)}]`);
    }
    // eslint-disable-next-line no-console
    console.groupEnd();

    // eslint-disable-next-line no-console
    console.group('Selection Results:');
    for (const breakdown of run.sourceBreakdowns) {
      const name = breakdown.sourceName || breakdown.sourceId;
      logger.info(`${name}:`);
      logger.info(
        `  Selected: ${breakdown.totalSelected}/${breakdown.reviewsProvided + breakdown.newProvided} (${breakdown.selectionRate.toFixed(1)}%)`
      );
      logger.info(`  Reviews: ${breakdown.reviewsSelected}/${breakdown.reviewsProvided}`);
      logger.info(`  New: ${breakdown.newSelected}/${breakdown.newProvided}`);

      // Identify potential issues
      if (breakdown.reviewsProvided > 0 && breakdown.reviewsSelected === 0) {
        logger.info(`  ⚠️ Had reviews but none selected!`);
      }
      if (breakdown.totalSelected === 0 && breakdown.reviewsProvided + breakdown.newProvided > 0) {
        logger.info(`  ⚠️ Had cards but none selected!`);
      }
    }
    // eslint-disable-next-line no-console
    console.groupEnd();

    // Check for imbalances
    const selectionRates = run.sourceBreakdowns.map((b) => b.selectionRate);
    const avgRate = selectionRates.reduce((a, b) => a + b, 0) / selectionRates.length;
    const maxDeviation = Math.max(...selectionRates.map((r) => Math.abs(r - avgRate)));

    if (maxDeviation > 20) {
      logger.info(`\n⚠️ Significant imbalance detected (max deviation: ${maxDeviation.toFixed(1)}%)`);
      logger.info('Possible causes:');
      logger.info('  - Score range differences between sources');
      logger.info('  - One source has much better quality cards');
      logger.info('  - Different card availability (reviews vs new)');
    }

    // eslint-disable-next-line no-console
    console.groupEnd();
  },

  /**
   * Compare score distributions across sources.
   */
  compareScores(): void {
    if (runHistory.length === 0) {
      logger.info('[Mixer Debug] No runs captured yet.');
      return;
    }

    const run = runHistory[0];

    // eslint-disable-next-line no-console
    console.group('📊 Score Distribution Comparison');

    // eslint-disable-next-line no-console
    console.table(
      run.sourceSummaries.map((src) => ({
        source: src.sourceName || src.sourceId,
        cards: src.totalCards,
        min: src.bottomScore.toFixed(3),
        max: src.topScore.toFixed(3),
        avg: src.avgScore.toFixed(3),
        range: (src.topScore - src.bottomScore).toFixed(3),
      }))
    );

    // Check for score normalization issues
    const ranges = run.sourceSummaries.map((s) => s.topScore - s.bottomScore);
    const avgScores = run.sourceSummaries.map((s) => s.avgScore);

    const rangeDiff = Math.max(...ranges) - Math.min(...ranges);
    const avgDiff = Math.max(...avgScores) - Math.min(...avgScores);

    if (rangeDiff > 0.3 || avgDiff > 0.2) {
      logger.info('\n⚠️ Significant score distribution differences detected');
      logger.info(
        'This may cause one source to dominate selection if using global sorting (not quota-based)'
      );
    }

    // eslint-disable-next-line no-console
    console.groupEnd();
  },

  /**
   * Show detailed information for a specific card.
   */
  showCard(cardId: string): void {
    for (const run of runHistory) {
      const card = run.cards.find((c) => c.cardId === cardId);
      if (card) {
        const source = run.sourceSummaries.find((s) => s.sourceIndex === card.sourceIndex);

        // eslint-disable-next-line no-console
        console.group(`🎴 Card: ${cardId}`);
        logger.info(`Course: ${card.courseId}`);
        logger.info(`Source: ${source?.sourceName || source?.sourceId || 'unknown'}`);
        logger.info(`Origin: ${card.origin}`);
        logger.info(`Score: ${card.score.toFixed(3)}`);
        if (card.rankInSource) {
          logger.info(`Rank in source: #${card.rankInSource}`);
        }
        if (card.rankInMix) {
          logger.info(`Rank in mixed results: #${card.rankInMix}`);
        }
        logger.info(`Selected: ${card.selected ? 'Yes ✅' : 'No ❌'}`);

        if (!card.selected && card.rankInSource) {
          logger.info('\nWhy not selected:');
          if (run.quotaPerSource && card.rankInSource > run.quotaPerSource) {
            logger.info(`  - Ranked #${card.rankInSource} in source, but quota was ${run.quotaPerSource}`);
          }
          logger.info('  - Check score compared to selected cards using .showRun()');
        }

        // eslint-disable-next-line no-console
        console.groupEnd();
        return;
      }
    }
    logger.info(`[Mixer Debug] Card '${cardId}' not found in recent runs.`);
  },

  /**
   * Show all runs in compact format.
   */
  listRuns(): void {
    if (runHistory.length === 0) {
      logger.info('[Mixer Debug] No runs captured yet.');
      return;
    }

    // eslint-disable-next-line no-console
    console.table(
      runHistory.map((r) => ({
        id: r.runId.slice(-8),
        time: r.timestamp.toLocaleTimeString(),
        mixer: r.mixerType,
        sources: r.sourceSummaries.length,
        selected: r.finalCount,
        reviews: r.reviewsSelected,
        new: r.newSelected,
      }))
    );
  },

  /**
   * Export run history as JSON for bug reports.
   */
  export(): string {
    const json = JSON.stringify(runHistory, null, 2);
    logger.info('[Mixer Debug] Run history exported. Copy the returned string or use:');
    logger.info('  copy(window.skuilder.mixer.export())');
    return json;
  },

  /**
   * Clear run history.
   */
  clear(): void {
    runHistory.length = 0;
    logger.info('[Mixer Debug] Run history cleared.');
  },

  /**
   * Show help.
   */
  help(): void {
    logger.info(`
🎨 Mixer Debug API

Commands:
  .showLastMix()           Show summary of most recent mixer run
  .showRun(id|index)       Show summary of a specific run (by index or ID suffix)
  .explainSourceBalance()  Analyze source balance and selection patterns
  .compareScores()         Compare score distributions across sources
  .showCard(cardId)        Show mixer decisions for a specific card
  .listRuns()              List all captured runs in table format
  .export()                Export run history as JSON for bug reports
  .clear()                 Clear run history
  .runs                    Access raw run history array
  .help()                  Show this help message

Example:
  window.skuilder.mixer.showLastMix()
  window.skuilder.mixer.explainSourceBalance()
  window.skuilder.mixer.compareScores()
`);
  },
};

// ============================================================================
// WINDOW MOUNT
// ============================================================================

/**
 * Mount the debug API on window.skuilder.mixer
 */
export function mountMixerDebugger(): void {
  if (typeof window === 'undefined') return;

  const win = window as any;
  win.skuilder = win.skuilder || {};
  win.skuilder.mixer = mixerDebugAPI;
}

// Auto-mount when module is loaded
mountMixerDebugger();
