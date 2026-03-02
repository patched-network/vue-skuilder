import type { WeightedCard, StrategyContribution } from './index';
import {
  getRegisteredNavigatorNames,
  getRegisteredNavigatorRole,
  NavigatorRoles,
  type Navigators,
  isGenerator,
  isFilter,
} from './index';
import { logger } from '../../util/logger';
import type { Pipeline, CardSpaceDiagnosis } from './Pipeline';

/**
 * Captured reference to the most recently created Pipeline instance.
 * Used by the debug API to run diagnostics against the live pipeline.
 */
let _activePipeline: Pipeline | null = null;

/**
 * Register a pipeline instance for diagnostic access.
 * Called by Pipeline constructor.
 */
export function registerPipelineForDebug(pipeline: Pipeline): void {
  _activePipeline = pipeline;
}

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

  /** User's global ELO at the time of this pipeline run */
  userElo?: number;

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
    /** Card's ELO (parsed from ELO generator provenance, if available) */
    cardElo?: number;
    provenance: StrategyContribution[];
    tags?: string[];
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
/**
 * Parse card ELO from the ELO generator's provenance reason string.
 * Format: "ELO distance XX (card: YYYY, user: ZZZZ), ..."
 */
function parseCardElo(provenance: StrategyContribution[]): number | undefined {
  const eloEntry = provenance.find((p) => p.strategy === 'elo');
  if (!eloEntry?.reason) return undefined;
  const match = eloEntry.reason.match(/card:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

export function buildRunReport(
  courseId: string,
  courseName: string | undefined,
  generatorName: string,
  generators: GeneratorSummary[] | undefined,
  generatedCount: number,
  filters: FilterImpact[],
  allCards: WeightedCard[],
  selectedCards: WeightedCard[],
  userElo?: number
): Omit<PipelineRunReport, 'runId' | 'timestamp'> {
  const selectedIds = new Set(selectedCards.map((c) => c.cardId));

  const cards = allCards.map((card) => ({
    cardId: card.cardId,
    courseId: card.courseId,
    origin: getOrigin(card),
    finalScore: card.score,
    cardElo: parseCardElo(card.provenance),
    provenance: card.provenance,
    tags: card.tags,
    selected: selectedIds.has(card.cardId),
  }));

  const reviewsSelected = selectedCards.filter((c) => getOrigin(c) === 'review').length;
  const newSelected = selectedCards.filter((c) => getOrigin(c) === 'new').length;

  return {
    courseId,
    courseName,
    userElo,
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
 * Print summary of a single pipeline run.
 */
function printRunSummary(run: PipelineRunReport): void {
  // eslint-disable-next-line no-console
  console.group(`🔍 Pipeline Run: ${run.courseId} (${run.courseName || 'unnamed'})`);
  logger.info(`Run ID: ${run.runId}`);
  logger.info(`Time: ${run.timestamp.toISOString()}`);
  logger.info(`User ELO: ${run.userElo ?? 'unknown'}`);
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

  logger.info(
    `Result: ${run.finalCount} cards selected (${run.newSelected} new, ${run.reviewsSelected} reviews)`
  );
  // eslint-disable-next-line no-console
  console.groupEnd();
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
   * Show summary of a specific pipeline run.
   */
  showRun(idOrIndex: string | number = 0): void {
    if (runHistory.length === 0) {
      logger.info('[Pipeline Debug] No runs captured yet.');
      return;
    }

    let run: PipelineRunReport | undefined;

    if (typeof idOrIndex === 'number') {
      run = runHistory[idOrIndex];
      if (!run) {
        logger.info(
          `[Pipeline Debug] No run found at index ${idOrIndex}. History length: ${runHistory.length}`
        );
        return;
      }
    } else {
      run = runHistory.find((r) => r.runId.endsWith(idOrIndex));
      if (!run) {
        logger.info(`[Pipeline Debug] No run found matching ID '${idOrIndex}'.`);
        return;
      }
    }

    printRunSummary(run);
  },

  /**
   * Show summary of the last pipeline run.
   */
  showLastRun(): void {
    this.showRun(0);
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
        logger.info(`Card ELO: ${card.cardElo ?? 'unknown'} | User ELO: ${run.userElo ?? 'unknown'}`);
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
   * Show the navigator registry: all registered classes and their roles.
   *
   * Useful for verifying that consumer-defined navigators were registered
   * before pipeline assembly.
   */
  showRegistry(): void {
    const names = getRegisteredNavigatorNames();
    if (names.length === 0) {
      logger.info('[Pipeline Debug] Navigator registry is empty.');
      return;
    }

    // eslint-disable-next-line no-console
    console.group('📦 Navigator Registry');
    // eslint-disable-next-line no-console
    console.table(
      names.map((name) => {
        const registryRole = getRegisteredNavigatorRole(name);
        const builtinRole = NavigatorRoles[name as Navigators];
        const effectiveRole = builtinRole || registryRole || '⚠️ NONE';
        const source = builtinRole ? 'built-in' : registryRole ? 'consumer' : 'unclassified';
        return {
          name,
          role: effectiveRole,
          source,
          isGenerator: isGenerator(name),
          isFilter: isFilter(name),
        };
      })
    );
    // eslint-disable-next-line no-console
    console.groupEnd();
  },

  /**
   * Show strategy documents from the last pipeline run and how they mapped
   * to the registry.
   *
   * If no runs are captured yet, falls back to showing just the registry.
   */
  showStrategies(): void {
    this.showRegistry();

    if (runHistory.length === 0) {
      logger.info('[Pipeline Debug] No pipeline runs captured yet — cannot show strategy doc mapping.');
      return;
    }

    const run = runHistory[0];
    // eslint-disable-next-line no-console
    console.group('🔌 Pipeline Strategy Mapping (last run)');
    logger.info(`Generator: ${run.generatorName}`);
    if (run.generators && run.generators.length > 0) {
      for (const g of run.generators) {
        logger.info(`  📥 ${g.name}: ${g.cardCount} cards (${g.newCount} new, ${g.reviewCount} reviews)`);
      }
    }
    if (run.filters.length > 0) {
      logger.info('Filters:');
      for (const f of run.filters) {
        logger.info(`  🔸 ${f.name}: ↑${f.boosted} ↓${f.penalized} =${f.passed} ✕${f.removed}`);
      }
    } else {
      logger.info('Filters: (none)');
    }
    // eslint-disable-next-line no-console
    console.groupEnd();
  },

  /**
   * Scan the full card space through the filter chain for the current user.
   *
   * Reports how many cards are well-indicated and how many are new.
   * Use this to understand how the search space grows during onboarding.
   *
   * @param threshold - Score threshold for "well indicated" (default 0.10)
   */
  async diagnoseCardSpace(threshold?: number): Promise<CardSpaceDiagnosis | null> {
    if (!_activePipeline) {
      logger.info('[Pipeline Debug] No active pipeline. Run a session first.');
      return null;
    }
    return _activePipeline.diagnoseCardSpace({ threshold });
  },

  /**
   * Show help.
   */
  help(): void {
    logger.info(`
🔧 Pipeline Debug API

Commands:
  .showLastRun()         Show summary of most recent pipeline run
  .showRun(id|index)     Show summary of a specific run (by index or ID suffix)
  .showCard(cardId)      Show provenance trail for a specific card
  .explainReviews()      Analyze why reviews were/weren't selected
  .diagnoseCardSpace()   Scan full card space through filters (async)
  .showRegistry()        Show navigator registry (classes + roles)
  .showStrategies()      Show registry + strategy mapping from last run
  .listRuns()            List all captured runs in table format
  .export()              Export run history as JSON for bug reports
  .clear()               Clear run history
  .runs                  Access raw run history array
  .help()                Show this help message

Example:
  window.skuilder.pipeline.showLastRun()
  window.skuilder.pipeline.showRun(1)
  await window.skuilder.pipeline.diagnoseCardSpace()
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