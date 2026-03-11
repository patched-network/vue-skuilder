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
//   window.skuilder.pipeline.showPrescribed()
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

// ============================================================================
// UI DEBUGGER (VANILLA HTML)
// ============================================================================

let _uiContainer: HTMLElement | null = null;
let _selectedRunIndex: number | null = null;
let _cardSearchQuery = '';

function renderUI(): void {
  if (!_uiContainer) return;

  const runs = runHistory;
  const selectedRun = _selectedRunIndex !== null ? runs[_selectedRunIndex] : null;

  const styles = `
    #sk-pipeline-debugger {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #f8f9fa;
      color: #212529;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
    }
    #sk-pipeline-debugger header {
      padding: 1rem;
      background: #343a40;
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #sk-pipeline-debugger .container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    #sk-pipeline-debugger .sidebar {
      width: 300px;
      border-right: 1px solid #dee2e6;
      overflow-y: auto;
      background: white;
    }
    #sk-pipeline-debugger .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
    }
    #sk-pipeline-debugger .run-item {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #eee;
      cursor: pointer;
    }
    #sk-pipeline-debugger .run-item:hover { background: #f1f3f5; }
    #sk-pipeline-debugger .run-item.active { background: #e9ecef; border-left: 4px solid #007bff; }
    #sk-pipeline-debugger h2, #sk-pipeline-debugger h3 { margin-top: 0; }
    #sk-pipeline-debugger table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; background: white; }
    #sk-pipeline-debugger th, #sk-pipeline-debugger td { border: 1px solid #dee2e6; padding: 0.5rem; text-align: left; }
    #sk-pipeline-debugger th { background: #f1f3f5; }
    #sk-pipeline-debugger code { background: #f1f3f5; padding: 0.1rem 0.3rem; border-radius: 3px; font-family: monospace; }
    #sk-pipeline-debugger .close-btn { background: #dc3545; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
    #sk-pipeline-debugger .search-box { margin-bottom: 1rem; width: 100%; padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px; }
    #sk-pipeline-debugger .provenance { font-size: 12px; color: #666; margin-top: 0.25rem; white-space: pre-wrap; font-family: monospace; background: #f8f9fa; padding: 0.5rem; border-radius: 4px; }
  `;

  const runListHtml =
    runs.length === 0
      ? '<div style="padding: 1rem;">No runs captured yet.</div>'
      : runs
          .map(
            (r, i) => `
        <div class="run-item ${i === _selectedRunIndex ? 'active' : ''}" onclick="window.skuilder.pipeline._selectRun(${i})">
          <strong>${r.timestamp.toLocaleTimeString()}</strong><br/>
          <small>${r.courseName || r.courseId.slice(0, 8)}</small><br/>
          <small>${r.finalCount} cards selected</small>
        </div>
      `
          )
          .join('');

  let detailsHtml =
    '<div style="color: #6c757d; text-align: center; margin-top: 5rem;">Select a run to see details</div>';

  if (selectedRun) {
    const filteredCards = selectedRun.cards.filter(
      (c) =>
        !_cardSearchQuery || c.cardId.toLowerCase().includes(_cardSearchQuery.toLowerCase())
    );

    detailsHtml = `
      <h2>Run: ${selectedRun.runId}</h2>
      <p>
        <strong>Time:</strong> ${selectedRun.timestamp.toLocaleString()} | 
        <strong>Course:</strong> ${selectedRun.courseName || selectedRun.courseId} | 
        <strong>User ELO:</strong> ${selectedRun.userElo ?? 'unknown'}
      </p>

      <h3>Pipeline Config</h3>
      <table>
        <tr><th>Generator</th><td>${selectedRun.generatorName} (${selectedRun.generatedCount} candidates)</td></tr>
        ${(selectedRun.generators || [])
          .map(
            (g) => `
          <tr><td style="padding-left: 2rem;">↳ ${g.name}</td><td>${g.cardCount} cards (${g.newCount} new, ${g.reviewCount} review, top: ${g.topScore.toFixed(2)})</td></tr>
        `
          )
          .join('')}
      </table>

      <h3>Filter Impact</h3>
      <table>
        <thead><tr><th>Filter</th><th>Boosted</th><th>Penalized</th><th>Passed</th><th>Removed</th></tr></thead>
        <tbody>
          ${selectedRun.filters
            .map(
              (f) => `
            <tr><td>${f.name}</td><td>↑${f.boosted}</td><td>↓${f.penalized}</td><td>=${f.passed}</td><td>✕${f.removed}</td></tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <h3>Cards (${selectedRun.finalCount} selected / ${selectedRun.cards.length} total)</h3>
      <input type="text" class="search-box" placeholder="Search Card ID..." value="${_cardSearchQuery}" oninput="window.skuilder.pipeline._setSearch(this.value)">
      
      <table>
        <thead><tr><th>ID</th><th>Origin</th><th>Score</th><th>Selected</th></tr></thead>
        <tbody>
          ${filteredCards
            .map(
              (c) => `
            <tr>
              <td><code>${c.cardId}</code></td>
              <td>${c.origin}</td>
              <td>${c.finalScore.toFixed(3)}</td>
              <td>${c.selected ? '✅' : '❌'}</td>
            </tr>
            ${
              c.selected || _cardSearchQuery
                ? `
              <tr>
                <td colspan="4">
                  <div class="provenance">${formatProvenance(c.provenance)}</div>
                </td>
              </tr>
            `
                : ''
            }
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  _uiContainer.innerHTML = `
    <style>${styles}</style>
    <header>
      <strong>Pipeline Debugger</strong>
      <button class="close-btn" onclick="window.skuilder.pipeline.ui()">Close</button>
    </header>
    <div class="container">
      <div class="sidebar">${runListHtml}</div>
      <div class="main-content">${detailsHtml}</div>
    </div>
  `;
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
        if (card.tags && card.tags.length > 0) {
          logger.info(`Tags (${card.tags.length}): ${card.tags.join(', ')}`);
        }
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
   * Show prescribed-related cards from the most recent run.
   *
   * Highlights:
   * - cards directly generated by the prescribed strategy
   * - blocked prescribed targets mentioned in provenance
   * - support tags resolved for blocked targets
   *
   * @param groupId - Optional prescribed group ID filter (e.g. 'intro-core')
   */
  showPrescribed(groupId?: string): void {
    if (runHistory.length === 0) {
      logger.info('[Pipeline Debug] No runs captured yet.');
      return;
    }

    const run = runHistory[0];
    const prescribedCards = run.cards.filter((c) =>
      c.provenance.some((p) => p.strategy === 'prescribed')
    );

    // eslint-disable-next-line no-console
    console.group(`🧭 Prescribed Debug (${run.courseId})`);

    if (prescribedCards.length === 0) {
      logger.info('No prescribed-generated cards were present in the most recent run.');
      // eslint-disable-next-line no-console
      console.groupEnd();
      return;
    }

    const rows = prescribedCards
      .map((card) => {
        const prescribedProv = card.provenance.find((p) => p.strategy === 'prescribed');
        const reason = prescribedProv?.reason ?? '';
        const parsedGroup = reason.match(/group=([^;]+)/)?.[1] ?? 'unknown';
        const mode = reason.match(/mode=([^;]+)/)?.[1] ?? 'unknown';
        const blocked = reason.match(/blocked=([^;]+)/)?.[1] ?? 'unknown';
        const blockedTargets = reason.match(/blockedTargets=([^;]+)/)?.[1] ?? 'none';
        const supportCard = reason.match(/supportCard=([^;]+)/)?.[1] ?? 'none';
        const supportTags = reason.match(/supportTags=([^;]+)/)?.[1] ?? 'none';
        const multiplier = reason.match(/multiplier=([^;]+)/)?.[1] ?? 'unknown';
        const supportSource =
          mode === 'discovered-support'
            ? 'discovered'
            : mode === 'support'
              ? 'authored'
              : 'n/a';

        return {
          group: parsedGroup,
          mode,
          supportSource,
          cardId: card.cardId,
          selected: card.selected ? 'yes' : 'no',
          finalScore: card.finalScore.toFixed(3),
          blocked,
          blockedTargets,
          supportCard,
          supportTags,
          multiplier,
        };
      })
      .filter((row) => !groupId || row.group === groupId)
      .sort((a, b) => Number(b.finalScore) - Number(a.finalScore));

    if (rows.length === 0) {
      logger.info(
        `[Pipeline Debug] No prescribed cards matched group '${groupId}' in the most recent run.`
      );
      // eslint-disable-next-line no-console
      console.groupEnd();
      return;
    }

    // eslint-disable-next-line no-console
    console.table(rows);

    const selectedRows = rows.filter((r) => r.selected === 'yes');
    const blockedTargetSet = new Set<string>();
    const supportTagSet = new Set<string>();
    const authoredSupportSet = new Set<string>();
    const discoveredSupportSet = new Set<string>();

    for (const row of rows) {
      if (row.blockedTargets && row.blockedTargets !== 'none') {
        row.blockedTargets
          .split('|')
          .filter(Boolean)
          .forEach((t) => blockedTargetSet.add(t));
      }
      if (row.supportTags && row.supportTags !== 'none') {
        row.supportTags
          .split('|')
          .filter(Boolean)
          .forEach((t) => supportTagSet.add(t));
      }
      if (row.supportCard && row.supportCard !== 'none') {
        if (row.supportSource === 'discovered') {
          discoveredSupportSet.add(row.supportCard);
        } else if (row.supportSource === 'authored') {
          authoredSupportSet.add(row.supportCard);
        }
      }
    }

    logger.info(`Prescribed cards in run: ${rows.length}`);
    logger.info(`Selected prescribed cards: ${selectedRows.length}`);
    logger.info(
      `Blocked prescribed targets referenced: ${blockedTargetSet.size > 0 ? [...blockedTargetSet].join(', ') : 'none'}`
    );
    logger.info(
      `Resolved support tags referenced: ${supportTagSet.size > 0 ? [...supportTagSet].join(', ') : 'none'}`
    );
    logger.info(
      `Authored support cards emitted: ${authoredSupportSet.size > 0 ? [...authoredSupportSet].join(', ') : 'none'}`
    );
    logger.info(
      `Discovered support cards emitted: ${discoveredSupportSet.size > 0 ? [...discoveredSupportSet].join(', ') : 'none'}`
    );

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
   * Show user's per-tag ELO data. Useful for diagnosing hierarchy gate status.
   *
   * @param tagFilter - Optional glob pattern(s) to filter tags.
   *   Examples: 'gpc:expose:*', 'gpc:intro:t-T', ['gpc:expose:t-*', 'gpc:intro:t-*']
   */
  async showTagElo(tagFilter?: string | string[]): Promise<void> {
    if (!_activePipeline) {
      logger.info('[Pipeline Debug] No active pipeline. Run a session first.');
      return;
    }
    const status = await _activePipeline.getTagEloStatus(tagFilter);
    const entries = Object.entries(status).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) {
      logger.info(`[Pipeline Debug] No tag ELO data found${tagFilter ? ` for pattern: ${tagFilter}` : ''}.`);
      return;
    }
    // eslint-disable-next-line no-console
    console.table(
      Object.fromEntries(entries.map(([tag, data]) => [tag, { score: Math.round(data.score), count: data.count }]))
    );
  },

  /**
   * Toggle the full-screen UI debugger.
   */
  ui(): void {
    if (_uiContainer) {
      document.body.removeChild(_uiContainer);
      _uiContainer = null;
      return;
    }

    _uiContainer = document.createElement('div');
    _uiContainer.id = 'sk-pipeline-debugger';
    document.body.appendChild(_uiContainer);

    // Initial select last run if any
    if (_selectedRunIndex === null && runHistory.length > 0) {
      _selectedRunIndex = 0;
    }

    renderUI();
  },

  /**
   * Internal UI helpers
   * @internal
   */
  _selectRun(index: number): void {
    _selectedRunIndex = index;
    renderUI();
  },

  /**
   * Internal UI helpers
   * @internal
   */
  _setSearch(query: string): void {
    _cardSearchQuery = query;
    renderUI();
  },

  /**
   * Show help.
   */
  help(): void {
    logger.info(`
🔧 Pipeline Debug API

Commands:
  .ui()                  Toggle full-screen UI debugger
  .showLastRun()         Show summary of most recent pipeline run
  .showRun(id|index)     Show summary of a specific run (by index or ID suffix)
  .showCard(cardId)      Show provenance trail for a specific card
  .showTagElo(pattern)   Show user's tag ELO data (async). E.g. 'gpc:expose:*'
  .explainReviews()      Analyze why reviews were/weren't selected
  .diagnoseCardSpace()   Scan full card space through filters (async)
  .showRegistry()        Show navigator registry (classes + roles)
  .showStrategies()      Show registry + strategy mapping from last run
  .showPrescribed(id?)   Show prescribed-generated cards and blocked/support details from last run
  .listRuns()            List all captured runs in table format
  .export()              Export run history as JSON for bug reports
  .clear()               Clear run history
  .runs                  Access raw run history array
  .help()                Show this help message

Example:
  window.skuilder.pipeline.ui()
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