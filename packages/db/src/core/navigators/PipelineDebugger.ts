import type { WeightedCard, StrategyContribution } from './index';
import { logger } from '../../util/logger';

// ============================================================================
// PIPELINE DEBUGGER
// ============================================================================
//
// Console-accessible debug API for inspecting pipeline decisions.
//
// Exposed as `window.skuilder.pipeline` for interactive exploration.
//
// Usage:
//   window.skuilder.pipeline.showLastRun()
//   window.skuilder.pipeline.showCard('cardId123')
//   window.skuilder.pipeline.explainReviews()
//   window.skuilder.pipeline.export()
//
// ============================================================================

/**
 * Summary of a single generator's contribution.
 */
export interface GeneratorSummary {
  name: string;
  cardCount: number;
  newCount: number;
  reviewCount: number;
  topScore: number;
}

/**
 * Summary of a filter's impact on scores.
 */
export interface FilterImpact {
  name: string;
  boosted: number;
  penalized: number;
  passed: number;
  removed: number;
}

/**
 * Complete record of a single pipeline execution.
 */
export interface PipelineRunReport {
  runId: string;
  timestamp: Date;
  courseId: string;
  courseName?: string;

  // Generator phase
  generatorName: string;
  generators?: GeneratorSummary[];
  generatedCount: number;

  // Filter phase
  filters: FilterImpact[];

  // Results
  finalCount: number;
  reviewsSelected: number;
  newSelected: number;

  // Full card data for inspection
  cards: Array<{
    cardId: string;
    courseId: string;
    origin: 'new' | 'review' | 'unknown';
    finalScore: number;
    provenance: StrategyContribution[];
    selected: boolean;
  }>;
}

/**
 * Ring buffer for storing recent pipeline runs.
 */
const MAX_RUNS = 10;
const runHistory: PipelineRunReport[] = [];

/**
 * Determine card origin from provenance trail.
 */
function getOrigin(card: WeightedCard): 'new' | 'review' | 'unknown' {
  const firstEntry = card.provenance[0];
  if (!firstEntry) return 'unknown';
  const reason = firstEntry.reason?.toLowerCase() || '';
  if (reason.includes('new card')) return 'new';
  if (reason.includes('review')) return 'review';
  return 'unknown';
}

/**
 * Capture a pipeline run for later inspection.
 */
export function captureRun(report: Omit<PipelineRunReport, 'runId' | 'timestamp'>): void {
  const fullReport: PipelineRunReport = {
    ...report,
    runId: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
  };

  runHistory.unshift(fullReport);
  if (runHistory.length > MAX_RUNS) {
    runHistory.pop();
  }
}

/**
 * Build a capture-ready report from pipeline execution data.
 */
export function buildRunReport(
  courseId: string,
  courseName: string | undefined,
  generatorName: string,
  generators: GeneratorSummary[] | undefined,
  generatedCount: number,
  filters: FilterImpact[],
  allCards: WeightedCard[],
  selectedCards: WeightedCard[]
): Omit<PipelineRunReport, 'runId' | 'timestamp'> {
  const selectedIds = new Set(selectedCards.map((c) => c.cardId));

  const cards = allCards.map((card) => ({
    cardId: card.cardId,
    courseId: card.courseId,
    origin: getOrigin(card),
    finalScore: card.score,
    provenance: card.provenance,
    selected: selectedIds.has(card.cardId),
  }));

  const reviewsSelected = selectedCards.filter((c) => getOrigin(c) === 'review').length;
  const newSelected = selectedCards.filter((c) => getOrigin(c) === 'new').length;

  return {
    courseId,
    courseName,
    generatorName,
    generators,
    generatedCount,
    filters,
    finalCount: selectedCards.length,
    reviewsSelected,
    newSelected,
    cards,
  };
}

// ============================================================================
// CONSOLE API
// ============================================================================

/**
 * Format a provenance trail for console display.
 */
function formatProvenance(provenance: StrategyContribution[]): string {
  return provenance
    .map((p) => {
      const actionSymbol =
        p.action === 'generated'
          ? '🎲'
          : p.action === 'boosted'
            ? '⬆️'
            : p.action === 'penalized'
              ? '⬇️'
              : '➡️';
      return `  ${actionSymbol} ${p.strategyName}: ${p.score.toFixed(3)} - ${p.reason}`;
    })
    .join('\n');
}

/**
 * Console API object exposed on window.skuilder.pipeline
 */
export const pipelineDebugAPI = {
  /**
   * Get raw run history for programmatic access.
   */
  get runs(): PipelineRunReport[] {
    return [...runHistory];
  },

  /**
   * Show summary of the last pipeline run.
   */
  showLastRun(): void {
    if (runHistory.length === 0) {
      logger.info('[Pipeline Debug] No runs captured yet.');
      return;
    }

    const run = runHistory[0];
    // eslint-disable-next-line no-console
    console.group(`🔍 Pipeline Run: ${run.courseId} (${run.courseName || 'unnamed'})`);
    logger.info(`Time: ${run.timestamp.toISOString()}`);
    logger.info(`Generator: ${run.generatorName} → ${run.generatedCount} candidates`);

    if (run.generators && run.generators.length > 0) {
      // eslint-disable-next-line no-console
      console.group('Generator breakdown:');
      for (const g of run.generators) {
        logger.info(
          `  ${g.name}: ${g.cardCount} cards (${g.newCount} new, ${g.reviewCount} reviews, top: ${g.topScore.toFixed(2)})`
        );
      }
      // eslint-disable-next-line no-console
      console.groupEnd();
    }

    if (run.filters.length > 0) {
      // eslint-disable-next-line no-console
      console.group('Filter impact:');
      for (const f of run.filters) {
        logger.info(`  ${f.name}: ↑${f.boosted} ↓${f.penalized} =${f.passed} ✕${f.removed}`);
      }
      // eslint-disable-next-line no-console
      console.groupEnd();
    }

    logger.info(`Result: ${run.finalCount} cards selected (${run.newSelected} new, ${run.reviewsSelected} reviews)`);
    // eslint-disable-next-line no-console
    console.groupEnd();
  },

  /**
   * Show detailed provenance for a specific card.
   */
  showCard(cardId: string): void {
    for (const run of runHistory) {
      const card = run.cards.find((c) => c.cardId === cardId);
      if (card) {
        // eslint-disable-next-line no-console
        console.group(`🎴 Card: ${cardId}`);
        logger.info(`Course: ${card.courseId}`);
        logger.info(`Origin: ${card.origin}`);
        logger.info(`Final score: ${card.finalScore.toFixed(3)}`);
        logger.info(`Selected: ${card.selected ? 'Yes ✅' : 'No ❌'}`);
        logger.info('Provenance:');
        logger.info(formatProvenance(card.provenance));
        // eslint-disable-next-line no-console
        console.groupEnd();
        return;
      }
    }
    logger.info(`[Pipeline Debug] Card '${cardId}' not found in recent runs.`);
  },

  /**
   * Explain why reviews may or may not have been selected.
   */
  explainReviews(): void {
    if (runHistory.length === 0) {
      logger.info('[Pipeline Debug] No runs captured yet.');
      return;
    }

    // eslint-disable-next-line no-console
    console.group('📋 Review Selection Analysis');

    for (const run of runHistory) {
      // eslint-disable-next-line no-console
      console.group(`Run: ${run.courseId} @ ${run.timestamp.toLocaleTimeString()}`);

      const allReviews = run.cards.filter((c) => c.origin === 'review');
      const selectedReviews = allReviews.filter((c) => c.selected);

      if (allReviews.length === 0) {
        logger.info('❌ No reviews were generated. Check SRS logs for why.');
      } else if (selectedReviews.length === 0) {
        logger.info(`⚠️ ${allReviews.length} reviews generated but none selected.`);
        logger.info('Possible reasons:');

        // Check if new cards scored higher
        const topNewScore = Math.max(
          ...run.cards.filter((c) => c.origin === 'new' && c.selected).map((c) => c.finalScore),
          0
        );
        const topReviewScore = Math.max(...allReviews.map((c) => c.finalScore), 0);

        if (topReviewScore < topNewScore) {
          logger.info(
            `  - New cards scored higher (top new: ${topNewScore.toFixed(2)}, top review: ${topReviewScore.toFixed(2)})`
          );
        }

        // Show top review that didn't make it
        const topReview = allReviews.sort((a, b) => b.finalScore - a.finalScore)[0];
        if (topReview) {
          logger.info(`  - Top review score: ${topReview.finalScore.toFixed(3)}`);
          logger.info('  - Its provenance:');
          logger.info(formatProvenance(topReview.provenance));
        }
      } else {
        logger.info(`✅ ${selectedReviews.length}/${allReviews.length} reviews selected.`);
        logger.info('Top selected review:');
        const topSelected = selectedReviews.sort((a, b) => b.finalScore - a.finalScore)[0];
        logger.info(formatProvenance(topSelected.provenance));
      }

      // eslint-disable-next-line no-console
      console.groupEnd();
    }

    // eslint-disable-next-line no-console
    console.groupEnd();
  },

  /**
   * Show all runs in compact format.
   */
  listRuns(): void {
    if (runHistory.length === 0) {
      logger.info('[Pipeline Debug] No runs captured yet.');
      return;
    }

    // eslint-disable-next-line no-console
    console.table(
      runHistory.map((r) => ({
        id: r.runId.slice(-8),
        time: r.timestamp.toLocaleTimeString(),
        course: r.courseName || r.courseId.slice(0, 8),
        generated: r.generatedCount,
        selected: r.finalCount,
        new: r.newSelected,
        reviews: r.reviewsSelected,
      }))
    );
  },

  /**
   * Export run history as JSON for bug reports.
   */
  export(): string {
    const json = JSON.stringify(runHistory, null, 2);
    logger.info('[Pipeline Debug] Run history exported. Copy the returned string or use:');
    logger.info('  copy(window.skuilder.pipeline.export())');
    return json;
  },

  /**
   * Clear run history.
   */
  clear(): void {
    runHistory.length = 0;
    logger.info('[Pipeline Debug] Run history cleared.');
  },

  /**
   * Show help.
   */
  help(): void {
    logger.info(`
🔧 Pipeline Debug API

Commands:
  .showLastRun()         Show summary of most recent pipeline run
  .showCard(cardId)      Show provenance trail for a specific card
  .explainReviews()      Analyze why reviews were/weren't selected
  .listRuns()            List all captured runs in table format
  .export()              Export run history as JSON for bug reports
  .clear()               Clear run history
  .runs                  Access raw run history array
  .help()                Show this help message

Example:
  window.skuilder.pipeline.showLastRun()
  window.skuilder.pipeline.showCard('abc123')
`);
  },
};

// ============================================================================
// WINDOW MOUNT
// ============================================================================

/**
 * Mount the debug API on window.skuilder.pipeline
 */
export function mountPipelineDebugger(): void {
  if (typeof window === 'undefined') return;

  const win = window as any;
  win.skuilder = win.skuilder || {};
  win.skuilder.pipeline = pipelineDebugAPI;
}

// Auto-mount when module is loaded
mountPipelineDebugger();