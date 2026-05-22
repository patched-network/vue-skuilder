import { SrsService } from './services/SrsService';
import { EloService } from './services/EloService';
import { ResponseProcessor } from './services/ResponseProcessor';
import { CardHydrationService, HydratedCard } from './services/CardHydrationService';
import { ItemQueue } from './ItemQueue';
import {
  isReview,
  StudyContentSource,
  StudySessionFailedItem,
  StudySessionItem,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '@db/impl/couch';

import { CardRecord, CardHistory, CourseRegistrationDoc, QuestionRecord } from '@db/core';
import { recordUserOutcome } from '@db/core/orchestration/recording';
import { Loggable } from '@db/util';
import { getCardOrigin } from '@db/core/navigators';
import { ReplanHints } from '@db/core/navigators/generators/types';
import { SourceMixer, QuotaRoundRobinMixer, SourceBatch } from './SourceMixer';
import { captureMixerRun } from './MixerDebugger';
import { startSessionTracking, recordCardPresentation, snapshotQueues, endSessionTracking } from './SessionDebugger';

// ReplanHints is defined in generators/types to avoid circular dependencies.
// Re-exported here for backward compatibility.
export type { ReplanHints } from '@db/core/navigators/generators/types';

/**
 * Options for requesting a mid-session replan.
 *
 * All fields are optional — callers can pass just the fields they need.
 * When omitted, defaults match the existing behaviour (full 20-card
 * replace with no hints).
 */
export interface ReplanOptions {
  /** Scoring hints forwarded to the pipeline (boost/exclude/require). */
  hints?: ReplanHints;
  /**
   * Maximum number of new cards to return from the pipeline.
   * Default: 20 (the standard session batch size).
   */
  limit?: number;
  /**
   * How to integrate the new cards into the existing newQ.
   * - `'replace'` (default): atomically swap the entire newQ.
   * - `'merge'`: insert new cards at the front, keeping existing cards.
   */
  mode?: 'replace' | 'merge';
  /**
   * Guarantee that at least this many cards will be served after the
   * replan, even if the session timer has expired. Prevents intro cards
   * from surfacing at the end of a session with zero follow-up exercise.
   * Decremented on each card draw while active.
   */
  minFollowUpCards?: number;
  /**
   * Human-readable label for debugging / provenance.
   * Appears in console logs and in card provenance entries created
   * by ephemeral hint application.
   */
  label?: string;
}

export interface StudySessionRecord {
  card: {
    course_id: string;
    card_id: string;
    card_elo: number;
    tags: string[];
  };
  item: StudySessionItem;
  records: CardRecord[];
}

import { DataLayerProvider } from '@db/core';
import { logger } from '@db/util/logger';

export type SessionAction =
  | 'dismiss-success'
  | 'dismiss-failed'
  | 'marked-failed'
  | 'dismiss-error';

export interface ResponseResult {
  // Navigation
  nextCardAction: Exclude<SessionAction, 'dismiss-error'> | 'none';
  shouldLoadNextCard: boolean;

  /**
   * When true, the card requested deferred advancement via `deferAdvance`.
   * The record was logged and ELO updated, but navigation was suppressed.
   * StudySession should stash `nextCardAction` and wait for a
   * `ready-to-advance` event from the card before calling `nextCard()`.
   */
  deferred?: boolean;

  // UI Data (let view decide how to render)
  isCorrect: boolean;
  performanceScore?: number; // for shadow color calculation

  // Cleanup
  shouldClearFeedbackShadow: boolean;
}

interface SessionServices {
  response: ResponseProcessor;
}

export class SessionController<TView = unknown> extends Loggable {
  _className = 'SessionController';

  public services: SessionServices;
  private srsService: SrsService;
  private eloService: EloService;
  private hydrationService: CardHydrationService<TView>;
  private mixer: SourceMixer;
  private dataLayer: DataLayerProvider;
  private courseNameCache: Map<string, string> = new Map();

  /**
   * Default pipeline batch size for new-card planning.
   * Set via constructor options; falls back to 20 when not specified.
   * Individual replans can override via `ReplanOptions.limit`.
   */
  private _defaultBatchLimit: number = 20;

  /**
   * Maximum number of reviews enqueued at session start. Reviews live
   * outside the replan flow — the queue drains via consumption and is
   * not refilled mid-session. The session timer caps total review
   * exposure, so overfilling here is intentional. Default is generous
   * to accommodate Anki-style power users with hundreds of due reviews;
   * apps targeting nimbler sessions should override via constructor.
   */
  private _initialReviewCap: number = 200;

  private sources: StudyContentSource[];
  // dataLayer and getViewComponent now injected into CardHydrationService
  private _sessionRecord: StudySessionRecord[] = [];
  public set sessionRecord(r: StudySessionRecord[]) {
    this._sessionRecord = r;
  }

  // Session card stores
  private _currentCard: HydratedCard<TView> | null = null;

  private reviewQ: ItemQueue<StudySessionReviewItem> = new ItemQueue<StudySessionReviewItem>();
  private newQ: ItemQueue<StudySessionNewItem> = new ItemQueue<StudySessionNewItem>();
  private failedQ: ItemQueue<StudySessionFailedItem> = new ItemQueue<StudySessionFailedItem>();
  // END   Session card stores

  /**
   * Promise tracking a currently in-progress replan, or null if idle.
   * Used by nextCard() to await completion before drawing from queues.
   */
  private _replanPromise: Promise<void> | null = null;

  /**
   * Number of well-indicated new cards remaining before the queue
   * degrades to poorly-indicated content. Decremented on each newQ
   * draw; when it hits 0, a replan is triggered automatically
   * (user state has changed from completing good cards).
   */
  private _wellIndicatedRemaining: number = 0;

  /**
   * When true, suppresses the quality-based auto-replan trigger in
   * nextCard(). Set after a burst replan (small limit) to prevent the
   * auto-replan from clobbering the burst cards before they're consumed.
   * Cleared when the depletion-triggered replan fires (newQ exhausted).
   */
  private _suppressQualityReplan: boolean = false;

  /**
   * When > 0, the session timer cannot end the session. Decremented on
   * each nextCard() draw. Set by replans that include `minFollowUpCards`.
   */
  private _minCardsGuarantee: number = 0;

  private startTime: Date;
  private endTime: Date;
  private _secondsRemaining: number;
  public get secondsRemaining(): number {
    return this._secondsRemaining;
  }
  /** True when a card guarantee is active, preventing timer-based session end. */
  public get hasCardGuarantee(): boolean {
    return this._minCardsGuarantee > 0;
  }
  public get report(): string {
    const reviewCount = this.reviewQ.dequeueCount;
    const newCount = this.newQ.dequeueCount;
    const reviewWord = reviewCount === 1 ? 'review' : 'reviews';
    const newCardWord = newCount === 1 ? 'new card' : 'new cards';
    return `${reviewCount} ${reviewWord}, ${newCount} ${newCardWord}`;
  }
  public get detailedReport(): string {
    return this.newQ.toString + '\n' + this.reviewQ.toString + '\n' + this.failedQ.toString;
  }
  // @ts-expect-error NodeJS.Timeout type not available in browser context
  private _intervalHandle: NodeJS.Timeout;

  /**
   * @param sources - Array of content sources to mix for the session
   * @param time - Session duration in seconds
   * @param dataLayer - Data layer provider
   * @param getViewComponent - Function to resolve view components
   * @param mixer - Optional source mixer strategy (defaults to QuotaRoundRobinMixer)
   * @param options - Optional session-level configuration
   * @param options.defaultBatchLimit - Default pipeline batch size (default: 20).
   *   Smaller values for newer users cause more frequent replans, keeping plans
   *   aligned with rapidly-changing user state.
   * @param options.initialReviewCap - Max reviews loaded at session start (default: 200).
   *   Applied only on initial planning; replans do not refill the review queue.
   */
  constructor(
    sources: StudyContentSource[],
    time: number,
    dataLayer: DataLayerProvider,
    getViewComponent: (viewId: string) => TView,
    mixer?: SourceMixer,
    options?: { defaultBatchLimit?: number; initialReviewCap?: number }
  ) {
    super();

    this.dataLayer = dataLayer;
    this.mixer = mixer || new QuotaRoundRobinMixer();
    this.srsService = new SrsService(dataLayer.getUserDB());
    this.eloService = new EloService(dataLayer, dataLayer.getUserDB());

    this.hydrationService = new CardHydrationService<TView>(
      getViewComponent,
      (courseId: string) => dataLayer.getCourseDB(courseId),
      () => this._getItemsToHydrate()
    );

    this.services = {
      response: new ResponseProcessor(this.srsService, this.eloService),
    };

    this.sources = sources;
    this.startTime = new Date();
    this._secondsRemaining = time;
    this.endTime = new Date(this.startTime.valueOf() + 1000 * this._secondsRemaining);

    if (options?.defaultBatchLimit !== undefined) {
      this._defaultBatchLimit = options.defaultBatchLimit;
    }
    if (options?.initialReviewCap !== undefined) {
      this._initialReviewCap = options.initialReviewCap;
    }

    this.log(`Session constructed:
    startTime: ${this.startTime}
    endTime: ${this.endTime}
    defaultBatchLimit: ${this._defaultBatchLimit}
    initialReviewCap: ${this._initialReviewCap}`);
  }

  private tick() {
    this._secondsRemaining = Math.floor((this.endTime.valueOf() - Date.now()) / 1000);
    // this.log(this.secondsRemaining);

    if (this._secondsRemaining <= 0) {
      clearInterval(this._intervalHandle);
    }
  }

  /**
   * Returns a rough, erring toward conservative, guess at
   * the amount of time the failed cards queue will require
   * to clean up.
   *
   * (seconds)
   */
  private estimateCleanupTime(): number {
    let time: number = 0;
    for (let i = 0; i < this.failedQ.length; i++) {
      const c = this.failedQ.peek(i);
      // this.log(`Failed card ${c.qualifiedID} found`)

      const record = this._sessionRecord.find((r) => r.item.cardID === c.cardID);
      let cardTime = 0;

      if (record) {
        // this.log(`Card Record Found...`);
        for (let j = 0; j < record.records.length; j++) {
          cardTime += record.records[j].timeSpent;
        }
        cardTime = cardTime / record.records.length;
        time += cardTime;
      }
    }

    const ret: number = time / 1000;
    this.log(`Failed card cleanup estimate: ${Math.round(ret)}`);
    return ret;
  }

  /**
   * Extremely rough, conservative, estimate of amound of time to complete
   * all scheduled reviews
   */
  private estimateReviewTime(): number {
    const ret = 5 * this.reviewQ.length;
    this.log(`Review card time estimate: ${ret}`);
    return ret;
  }

  public async prepareSession() {
    // All content sources must implement getWeightedCards()
    if (this.sources.some((s) => typeof s.getWeightedCards !== 'function')) {
      throw new Error(
        '[SessionController] All content sources must implement getWeightedCards().'
      );
    }

    const wellIndicated = await this.getWeightedContent();
    this._wellIndicatedRemaining = wellIndicated;
    if (wellIndicated >= 0 && wellIndicated < SessionController.MIN_WELL_INDICATED) {
      this.log(
        `[Init] Only ${wellIndicated}/${SessionController.MIN_WELL_INDICATED} well-indicated cards in initial load`
      );
    }
    await this.hydrationService.ensureHydratedCards();

    // Start session tracking for debugging
    startSessionTracking(this.reviewQ.length, this.newQ.length, this.failedQ.length);

    this._intervalHandle = setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * Request a mid-session replan. Re-runs the pipeline with current user state
   * and atomically replaces the newQ contents. Safe to call at any time during
   * a session.
   *
   * Concurrency policy:
   * - Two unhinted auto-replans never run in parallel; the second coalesces
   *   into the first (returns the same promise).
   * - A hint-bearing replan that arrives while another replan is in flight
   *   is queued to run **after** the in-flight one rather than dropped.
   *   This preserves caller intent (label, requireCards, excludeTags,
   *   limit, minFollowUpCards) instead of silently discarding it. Without
   *   queueing, a background auto-replan that started just before a
   *   completion-triggered replan would clobber the queue with unhinted
   *   results (e.g. surfacing another gpc-intro card right after one
   *   completed, skipping the prescribed `c-wst-*` follow-up).
   *
   * Does NOT affect reviewQ or failedQ.
   *
   * If nextCard() is called while a replan is in flight, it will automatically
   * await the replan before drawing from queues, ensuring the user always sees
   * cards scored against their latest state.
   *
   * Typical trigger: application-level code (e.g. after a GPC intro completion)
   * calls this to ensure newly-unlocked content appears in the session.
   */
  public async requestReplan(options?: ReplanOptions | ReplanHints): Promise<void> {
    // Normalise: bare hints object (legacy callers) → ReplanOptions wrapper
    const opts = this.normalizeReplanOptions(options);

    const hasIntent = this._replanHasIntent(opts);

    if (this._replanPromise) {
      if (!hasIntent) {
        this.log('Replan already in progress, coalescing unhinted auto-replan');
        return this._replanPromise;
      }

      // Queue the hint-bearing replan behind the in-flight one rather than
      // dropping its hints. See class comment above for rationale.
      const labelTag = opts.label ? ` [${opts.label}]` : '';
      this.log(
        `Replan in progress; queueing hint-bearing replan${labelTag} behind in-flight run`
      );
      const inflight = this._replanPromise;
      const queued: Promise<void> = inflight
        // Swallow errors in the upstream replan so the downstream still runs
        // (the user's intent is independent of whether the prior run succeeded).
        .catch(() => undefined)
        .then(() => this._runReplan(opts));

      this._replanPromise = queued.finally(() => {
        if (this._replanPromise === queued) this._replanPromise = null;
      });

      return queued;
    }

    const run = this._runReplan(opts);
    this._replanPromise = run.finally(() => {
      if (this._replanPromise === run) this._replanPromise = null;
    });

    await run;
  }

  /**
   * True when a requestReplan call carries caller intent that must not be
   * silently dropped. Bare unhinted auto-replans (depletion / quality
   * triggers in nextCard) return false and may coalesce.
   */
  private _replanHasIntent(opts: ReplanOptions): boolean {
    if (opts.label) return true;
    if (opts.limit !== undefined) return true;
    if (opts.minFollowUpCards !== undefined) return true;
    if (opts.mode && opts.mode !== 'replace') return true;
    if (opts.hints && Object.keys(opts.hints).length > 0) return true;
    return false;
  }

  /**
   * Body of a single replan: populate auto-excludes, stash hints on
   * sources, log, then run the pipeline. Extracted so it can be invoked
   * either immediately (no in-flight replan) or queued (chained after
   * the in-flight one resolves).
   *
   * IMPORTANT: hint stash and the queue-state snapshot used to build
   * excludeCards happen at *invocation* time, not at *queue* time. For a
   * queued replan that means excludes reflect the state after the prior
   * replan landed — which is what we want, since the prior replan's
   * newQ.peek(0) is the imminent draw we need to exclude.
   */
  private async _runReplan(opts: ReplanOptions): Promise<void> {
    // Exclude all cards already presented this session. The pipeline may
    // not yet see their encounter records (async writes), so without this
    // they can re-enter newQ via replaceAll and cause duplicates.
    //
    // Also exclude newQ.peek(0): the imminent draw. When a replan fires
    // from inside nextCard() (auto depletion/quality trigger) or as a
    // deferred post-submit replan, the next-up card is about to become
    // _currentCard but isn't yet, and hasn't yet landed in _sessionRecord.
    // Without this, the just-drawn card can be re-seated at the head of
    // the replaced newQ and shown twice in a row — most visible in early
    // sessions where state is sparse and triggers fire aggressively.
    // Only the head is excluded; deeper newQ entries are still fair game
    // for the new plan (they aren't at risk of double-display since the
    // old queue is replaced atomically and only its head gets drawn).
    if (!opts.hints) opts.hints = {};
    const hints = opts.hints;
    const excludeSet = new Set(hints.excludeCards ?? []);

    if (this._currentCard?.item.cardID) {
      excludeSet.add(this._currentCard.item.cardID);
    }
    for (const rec of this._sessionRecord) {
      excludeSet.add(rec.card.card_id);
    }
    if (this.newQ.length > 0) {
      excludeSet.add(this.newQ.peek(0).cardID);
    }

    hints.excludeCards = [...excludeSet];

    // Forward hints to all sources (CourseDB stashes them, Pipeline consumes them)
    if (opts.hints) {
      // Thread label into hints so Pipeline can attach it to provenance
      const hintsWithLabel = opts.label
        ? { ...opts.hints, _label: opts.label }
        : opts.hints;
      for (const source of this.sources) {
        source.setEphemeralHints?.(hintsWithLabel);
      }
    }

    const labelTag = opts.label ? ` [${opts.label}]` : '';
    this.log(
      `Mid-session replan requested${labelTag}` +
      ` (limit: ${opts.limit ?? 'default'}, mode: ${opts.mode ?? 'replace'}` +
      `${opts.hints ? ', with hints' : ''})`
    );
    // Update card guarantee if requested
    if (opts.minFollowUpCards !== undefined && opts.minFollowUpCards > 0) {
      this._minCardsGuarantee = Math.max(this._minCardsGuarantee, opts.minFollowUpCards);
      this.log(`[Replan] Card guarantee set to ${this._minCardsGuarantee}`);
    }

    await this._executeReplan(opts);
  }

  /**
   * Run a replan, bypassing requestReplan()'s coalesce logic.
   *
   * Use this when correctness depends on a *fresh* pipeline run, not on
   * the existence of *some* in-flight replan. Specifically: the
   * wedge-breaker path in nextCard(), where coalescing into a previous
   * run that we now know produced insufficient content would re-create
   * the bug we're trying to prevent.
   *
   * Still tracks _replanPromise like requestReplan() does so concurrent
   * observers (auto-trigger guards in nextCard()) see consistent state.
   */
  private async _replanUncoalesced(opts: ReplanOptions): Promise<void> {
    const run = this._runReplan(opts);
    this._replanPromise = run.finally(() => {
      if (this._replanPromise === run) this._replanPromise = null;
    });
    await run;
  }

  /**
   * Normalise the requestReplan argument. Accepts either a ReplanOptions
   * object (new API) or a plain Record<string, unknown> (legacy callers
   * that passed hints directly). Distinguishes the two by checking for
   * the presence of ReplanOptions-specific keys.
   */
  private normalizeReplanOptions(
    input?: ReplanOptions | ReplanHints
  ): ReplanOptions {
    if (!input) return {};

    // If the input has any ReplanOptions-specific key, treat it as ReplanOptions
    const replanKeys = ['hints', 'limit', 'mode', 'label', 'minFollowUpCards'];
    const inputKeys = Object.keys(input);
    if (inputKeys.some((k) => replanKeys.includes(k))) {
      return input as ReplanOptions;
    }

    // Otherwise treat as legacy bare-hints object
    return { hints: input as ReplanHints };
  }

  /** Minimum well-indicated cards before an additive retry is attempted */
  private static readonly MIN_WELL_INDICATED = 5;

  /**
   * Score threshold for considering a card "well-indicated."
   * Cards below this score are treated as fallback filler — present only
   * because no strategy hard-removed them, but likely penalized by one
   * or more filters. Strategy-agnostic: the SessionController doesn't
   * know or care which strategy assigned the score.
   */
  private static readonly WELL_INDICATED_SCORE = 0.10;

  /**
   * Internal replan execution. Runs the pipeline, builds a new newQ,
   * atomically swaps it in, and triggers hydration for the new contents.
   *
   * If the initial replan produces fewer than MIN_WELL_INDICATED cards that
   * pass all hierarchy filters, one additive retry is attempted — merging
   * any new high-quality candidates into the front of the queue.
   */
  private async _executeReplan(opts: ReplanOptions = {}): Promise<void> {
    const limit = opts.limit;
    const mode = opts.mode ?? 'replace';

    const wellIndicated = await this.getWeightedContent({
      replan: true,
      additive: mode === 'merge',
      limit,
    });
    this._wellIndicatedRemaining = wellIndicated;

    // Burst replan: suppress quality-based auto-replan so the background
    // replan doesn't clobber the small hinted queue before it's consumed.
    // The depletion trigger (newQ empty) takes over instead.
    if (limit !== undefined && limit < this._defaultBatchLimit) {
      this._suppressQualityReplan = true;
      this.log(`[Replan] Burst mode (limit=${limit}): suppressing quality-based auto-replan`);
    } else {
      // Normal or auto-replan — clear the burst suppression flag
      this._suppressQualityReplan = false;
    }

    if (wellIndicated >= 0 && wellIndicated < SessionController.MIN_WELL_INDICATED) {
      this.log(
        `[Replan] Only ${wellIndicated}/${SessionController.MIN_WELL_INDICATED} well-indicated cards after replan`
      );
    }

    await this.hydrationService.ensureHydratedCards();
    const labelTag = opts.label ? ` [${opts.label}]` : '';
    this.log(`Replan complete${labelTag}: newQ now has ${this.newQ.length} cards (mode=${mode})`);

    // Snapshot queue state for debugging
    snapshotQueues(this.reviewQ.length, this.newQ.length, this.failedQ.length);
  }

  public addTime(seconds: number) {
    this.endTime = new Date(this.endTime.valueOf() + 1000 * seconds);
  }

  public get failedCount(): number {
    return this.failedQ.length;
  }

  public toString() {
    return `Session: ${this.reviewQ.length} Reviews, ${this.newQ.length} New, ${this.failedQ.length} failed`;
  }
  public reportString() {
    return `${this.reviewQ.dequeueCount} Reviews, ${this.newQ.dequeueCount} New, ${this.failedQ.dequeueCount} failed`;
  }

  /**
   * Returns debug information about the current session state.
   * Used by SessionControllerDebug component for runtime inspection.
   */
  public getDebugInfo() {
    // Check if sources support weighted cards
    const supportsWeightedCards = this.sources.some(
      (s) => typeof s.getWeightedCards === 'function'
    );

    const extractQueueItems = (queue: ItemQueue<any>, limit: number = 10) => {
      const items = [];
      for (let i = 0; i < Math.min(queue.length, limit); i++) {
        const item = queue.peek(i);
        items.push({
          courseID: item.courseID || 'unknown',
          cardID: item.cardID || 'unknown',
          status: item.status || 'unknown',
        });
      }
      return items;
    };

    return {
      api: {
        mode: supportsWeightedCards ? 'weighted' : 'legacy',
        description: supportsWeightedCards
          ? 'Using getWeightedCards() API with scored candidates'
          : 'ERROR: getWeightedCards() not a function.',
      },
      reviewQueue: {
        length: this.reviewQ.length,
        dequeueCount: this.reviewQ.dequeueCount,
        items: extractQueueItems(this.reviewQ),
      },
      newQueue: {
        length: this.newQ.length,
        dequeueCount: this.newQ.dequeueCount,
        items: extractQueueItems(this.newQ),
      },
      failedQueue: {
        length: this.failedQ.length,
        dequeueCount: this.failedQ.dequeueCount,
        items: extractQueueItems(this.failedQ),
      },
      hydratedCache: {
        count: this.hydrationService.hydratedCount,
        cardIds: this.hydrationService.getHydratedCardIds(),
      },
      replan: {
        inProgress: this._replanPromise !== null,
        suppressQualityReplan: this._suppressQualityReplan,
        defaultBatchLimit: this._defaultBatchLimit,
        minCardsGuarantee: this._minCardsGuarantee,
      },
    };
  }

  /**
   * Fetch content using the getWeightedCards API and mix across sources.
   *
   * This method:
   * 1. Fetches weighted cards from each source
   * 2. Fetches full review data (we need ScheduledCard fields for queue)
   * 3. Uses SourceMixer to balance content across sources
   * 4. Populates review and new card queues with mixed results
   */
  /**
   * Fetch weighted content from all sources and populate session queues.
   *
   * @param options.replan - If true, this is a mid-session replan rather than
   *   initial session setup. Skips review queue population (avoiding duplicates),
   *   atomically replaces newQ contents, and treats empty results as non-fatal.
   * @param options.additive - If true (replan only), merge new high-quality
   *   candidates into the front of the existing newQ instead of replacing it.
   * @returns Number of "well-indicated" cards (passed all hierarchy filters)
   *   in the new content. Returns -1 if no content was loaded.
   */
  private async getWeightedContent(options?: {
    replan?: boolean;
    additive?: boolean;
    limit?: number;
  }): Promise<number> {
    const replan = options?.replan ?? false;
    const additive = options?.additive ?? false;
    const newLimit = options?.limit ?? this._defaultBatchLimit;
    // Initial planning inflates the per-source budget so reviews can fill up
    // to _initialReviewCap independently of the new-card budget. Replans
    // never touch reviewQ, so the inflation is unnecessary there.
    const fetchLimit = replan ? newLimit : newLimit + this._initialReviewCap;

    // Collect batches from each source
    const batches: SourceBatch[] = [];

    for (let i = 0; i < this.sources.length; i++) {
      const source = this.sources[i];
      try {
        // Fetch weighted cards for mixing
        const weighted = (await source.getWeightedCards!(fetchLimit)).cards;

        batches.push({
          sourceIndex: i,
          weighted,
        });
      } catch (error) {
        this.error(`Failed to get content from source ${i}:`, error);
        // Re-throw if this is the only source - we can't proceed without any content
        if (this.sources.length === 1) {
          throw new Error(`Cannot start session: failed to load content from source ${i}`);
        }
      }
    }

    // Verify we got content from at least one source
    if (batches.length === 0) {
      if (replan) {
        // Replan finding no content is non-fatal — old queue remains
        this.log('Replan: no content from any source, keeping existing newQ');
        return -1;
      }
      throw new Error(
        `Cannot start session: failed to load content from all ${this.sources.length} source(s). ` +
          `Check logs for details.`
      );
    }

    // Mix weighted cards across sources using configured strategy
    const mixedWeighted = this.mixer.mix(batches, fetchLimit * this.sources.length);

    // Capture mixer run for debugging - fetch course names
    const sourceIds = batches.map((b) => {
      const firstCard = b.weighted[0];
      return firstCard?.courseId || `source-${b.sourceIndex}`;
    });
    // Populate course name cache (one-time fetch, reused by SessionDebugger)
    await Promise.all(
      sourceIds.map(async (id) => {
        if (!this.courseNameCache.has(id)) {
          try {
            const config = await this.dataLayer.getCoursesDB().getCourseConfig(id);
            this.courseNameCache.set(id, config.name);
          } catch {
            // leave unmapped
          }
        }
      })
    );
    const sourceNames = sourceIds.map((id) => this.courseNameCache.get(id));
    const quotaPerSource =
      this.mixer instanceof QuotaRoundRobinMixer ? Math.ceil((fetchLimit * this.sources.length) / batches.length) : undefined;
    captureMixerRun(
      this.mixer.constructor.name,
      batches,
      sourceIds,
      sourceNames,
      fetchLimit * this.sources.length,
      quotaPerSource,
      mixedWeighted
    );

    // Split mixed results by card origin, then apply per-origin caps. The
    // pre-mixer fetch is inflated to fit both budgets; trimming here keeps
    // newQ at the nimble batch size while letting reviewQ overfill up to
    // _initialReviewCap (replan path discards reviewWeighted entirely).
    const reviewWeighted = mixedWeighted
      .filter((w) => getCardOrigin(w) === 'review')
      .slice(0, this._initialReviewCap);
    const newWeighted = mixedWeighted
      .filter((w) => getCardOrigin(w) === 'new')
      .slice(0, newLimit);

    logger.debug(`[reviews] got ${reviewWeighted.length} reviews from mixer`);

    // Populate review queue from mixed results (skip during replan to avoid duplicates)
    let report = replan ? 'Replan content:\n' : 'Mixed content session created with:\n';
    if (!replan) {
      for (const w of reviewWeighted) {
        const reviewItem: StudySessionReviewItem = {
          cardID: w.cardId,
          courseID: w.courseId,
          contentSourceType: 'course',
          contentSourceID: w.courseId,
          reviewID: w.reviewID!,
          status: 'review',
        };
        this.reviewQ.add(reviewItem, reviewItem.cardID);
        report += `Review: ${w.courseId}::${w.cardId} (score: ${w.score.toFixed(2)})\n`;
      }
    }

    // Count well-indicated cards by final score. Cards above the threshold
    // are genuinely appropriate content; cards below are fallback filler
    // that survived only because no strategy hard-removed them.
    const wellIndicated = newWeighted.filter(
      (w) => w.score >= SessionController.WELL_INDICATED_SCORE
    ).length;

    // Build new card items
    const newItems: StudySessionNewItem[] = [];
    for (const w of newWeighted) {
      const newItem: StudySessionNewItem = {
        cardID: w.cardId,
        courseID: w.courseId,
        contentSourceType: 'course',
        contentSourceID: w.courseId,
        status: 'new',
      };
      newItems.push(newItem);
      report += `New: ${w.courseId}::${w.cardId} (score: ${w.score.toFixed(2)})\n`;
    }

    if (additive) {
      // Additive replan: merge new candidates into front of existing queue
      const added = this.newQ.mergeToFront(newItems, (item) => item.cardID);
      report += `Additive merge: ${added} new cards added to front of newQ\n`;
    } else if (replan) {
      // Atomic swap: replace entire newQ contents at once (no empty-queue window)
      this.newQ.replaceAll(newItems, (item) => item.cardID);
    } else {
      // Initial session setup: add items normally
      for (const item of newItems) {
        this.newQ.add(item, item.cardID);
      }
    }

    this.log(report);
    return wellIndicated;
  }

  /**
   * Returns items that should be pre-hydrated.
   * Deterministic: top N items from each queue to ensure coverage.
   * Failed queue items will typically already be hydrated (from initial render).
   */
  private _getItemsToHydrate(): StudySessionItem[] {
    const items: StudySessionItem[] = [];
    const ITEMS_PER_QUEUE = 2;

    for (let i = 0; i < Math.min(ITEMS_PER_QUEUE, this.reviewQ.length); i++) {
      items.push(this.reviewQ.peek(i));
    }
    for (let i = 0; i < Math.min(ITEMS_PER_QUEUE, this.newQ.length); i++) {
      items.push(this.newQ.peek(i));
    }
    for (let i = 0; i < Math.min(ITEMS_PER_QUEUE, this.failedQ.length); i++) {
      items.push(this.failedQ.peek(i));
    }

    return items;
  }

  /**
   * Selects the next item to present to the user.
   * Nondeterministic: uses probability to balance between queues based on session state.
   */
  private _selectNextItemToHydrate(): StudySessionItem | null {
    const choice = Math.random();
    let newBound: number = 0.1;
    let reviewBound: number = 0.75;

    if (this.reviewQ.length === 0 && this.failedQ.length === 0 && this.newQ.length === 0) {
      // all queues empty - session is over (and course is complete?)
      return null;
    }

    if (this._secondsRemaining < 2 && this.failedQ.length === 0 && this._minCardsGuarantee <= 0) {
      // session is over!
      return null;
    }

    // If timer expired, only return failed cards (unless card guarantee active)
    if (this._secondsRemaining <= 0 && this._minCardsGuarantee <= 0) {
      if (this.failedQ.length > 0) {
        return this.failedQ.peek(0);
      } else {
        return null; // No more failed cards, session over
      }
    }

    // supply new cards at start of session
    if (this.newQ.dequeueCount < this.sources.length && this.newQ.length) {
      return this.newQ.peek(0);
    }

    const cleanupTime = this.estimateCleanupTime();
    const reviewTime = this.estimateReviewTime();
    const availableTime = this._secondsRemaining - (cleanupTime + reviewTime);

    // if time-remaing vs (reviewQ + failureQ) looks good,
    // lean toward newQ
    if (availableTime > 20) {
      newBound = 0.5;
      reviewBound = 0.9;
    }
    // else if time-remaining vs failureQ looks good,
    // lean toward reviewQ
    else if (this._secondsRemaining - cleanupTime > 20) {
      newBound = 0.05;
      reviewBound = 0.9;
    }
    // else (time-remaining vs failureQ looks bad!)
    // lean heavily toward failureQ
    else {
      newBound = 0.01;
      reviewBound = 0.1;
    }

    // exclude possibility of drawing from empty queues
    if (this.failedQ.length === 0) {
      reviewBound = 1;
    }
    if (this.reviewQ.length === 0) {
      newBound = reviewBound;
    }

    if (choice < newBound && this.newQ.length) {
      return this.newQ.peek(0);
    } else if (choice < reviewBound && this.reviewQ.length) {
      return this.reviewQ.peek(0);
    } else if (this.failedQ.length) {
      return this.failedQ.peek(0);
    } else {
      this.log(`No more cards available for the session!`);
      return null;
    }
  }

  public async nextCard(
    action: SessionAction = 'dismiss-success'
  ): Promise<HydratedCard<TView> | null> {
    // dismiss (or sort to failedQ) the current card
    this.dismissCurrentCard(action);

    // Decrement card guarantee counter
    if (this._minCardsGuarantee > 0) {
      this._minCardsGuarantee--;
      this.log(`[CardGuarantee] ${this._minCardsGuarantee} guaranteed cards remaining`);
    }

    // If a replan is in flight AND we have nothing queued to serve, wait for
    // it. When queues still have cards, draw from them immediately and let
    // the replan land asynchronously — blocking here adds visible lag
    // between cards for a marginal scoring-freshness benefit. The
    // wedge-breaker below handles the genuinely-empty case.
    if (
      this._replanPromise &&
      this.newQ.length === 0 &&
      this.reviewQ.length === 0 &&
      this.failedQ.length === 0
    ) {
      this.log('nextCard: queues empty, awaiting in-flight replan before drawing');
      await this._replanPromise;
    }

    // --- Replan triggers ---
    //
    // Two flavors:
    //
    //  (a) OPPORTUNISTIC PREFETCH (best-effort, may coalesce, may no-op):
    //      `depletion` and `quality` triggers below. Their job is to make
    //      replans happen *early*, so the user doesn't wait. They are
    //      *not* responsible for making replans happen *at all* — if every
    //      one of them gets eaten by coalescing or suppression, that's
    //      fine. They are perf optimizations.
    //
    //  (b) LOAD-BEARING WEDGE-BREAKER (correctness):
    //      Below, right before the draw loop. Invariant: if the clock is
    //      ticking and we'd otherwise serve null, the pipeline runs. No
    //      coalesce, no latch, no flag. This is the *only* guarantee.
    //
    // Rule of thumb: a redundant pipeline run is a perf bug, a missing
    // pipeline run is a correctness bug. Bias toward the cheaper failure.

    // Opportunistic depletion: newQ running dry → background prefetch.
    // No latch — if this fires repeatedly when the pipeline keeps coming
    // back empty, the wedge-breaker's local backoff handles spin protection.
    if (
      this.newQ.length <= 1 &&
      this._secondsRemaining > 0 &&
      !this._replanPromise
    ) {
      this._suppressQualityReplan = false; // burst is (nearly) consumed
      const otherContent = this.reviewQ.length + this.failedQ.length;
      this.log(
        `[AutoReplan:depletion] newQ has ${this.newQ.length} card(s) ` +
        `(${otherContent} in other queues) with ${this._secondsRemaining}s remaining. ` +
        `Triggering background replan.`
      );
      void this.requestReplan();
    }

    // Opportunistic quality: few well-indicated cards remain.
    // Suppressed after a burst replan to avoid clobbering burst cards.
    const REPLAN_BUFFER = 3;
    if (
      !this._suppressQualityReplan &&
      this._wellIndicatedRemaining <= REPLAN_BUFFER &&
      this.newQ.length > 0 &&
      !this._replanPromise
    ) {
      this.log(
        `[AutoReplan:quality] ${this._wellIndicatedRemaining} well-indicated cards remaining ` +
        `(newQ: ${this.newQ.length}). Triggering background replan.`
      );
      void this.requestReplan();
    }

    if (this._secondsRemaining <= 0 && this.failedQ.length === 0 && this._minCardsGuarantee <= 0) {
      this._currentCard = null;
      endSessionTracking();
      return null;
    }

    // Wedge-breaker (correctness path).
    //
    // If we'd otherwise be about to draw from empty queues with time on
    // the clock, run the pipeline. Bypasses requestReplan() coalesce
    // because coalescing into a previous run that we now know produced
    // insufficient content is the exact failure mode this defends against.
    //
    // Bounded by an empty-streak counter: if the pipeline consistently
    // returns nothing, we eventually give up and let the session end
    // gracefully rather than spin forever.
    const WEDGE_MAX_EMPTY_STREAK = 3;
    const WEDGE_BACKOFF_MS = 250;
    let wedgeEmptyStreak = 0;
    while (
      this._secondsRemaining > 0 &&
      this.newQ.length === 0 &&
      this.reviewQ.length === 0 &&
      this.failedQ.length === 0
    ) {
      this.log(
        `[WedgeBreaker] All queues empty with ${this._secondsRemaining}s remaining. ` +
        `Running pipeline (attempt ${wedgeEmptyStreak + 1}/${WEDGE_MAX_EMPTY_STREAK}).`
      );
      await this._replanUncoalesced({ label: 'wedge-breaker' });
      if (
        this.newQ.length === 0 &&
        this.reviewQ.length === 0 &&
        this.failedQ.length === 0
      ) {
        wedgeEmptyStreak++;
        if (wedgeEmptyStreak >= WEDGE_MAX_EMPTY_STREAK) {
          this.log(
            `[WedgeBreaker] Pipeline returned no content ${WEDGE_MAX_EMPTY_STREAK} consecutive ` +
            `times. Giving up; session will end.`
          );
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, WEDGE_BACKOFF_MS));
      } else {
        wedgeEmptyStreak = 0;
      }
    }

    // Try multiple cards in case some fail hydration (e.g., deleted from DB)
    const MAX_SKIP = 20;
    for (let attempt = 0; attempt < MAX_SKIP; attempt++) {
      const nextItem = this._selectNextItemToHydrate();
      if (!nextItem) {
        this._currentCard = null;
        endSessionTracking();
        return null;
      }

      // Look up in hydration cache
      let card = this.hydrationService.getHydratedCard(nextItem.cardID);

      // If not ready, wait for it
      if (!card) {
        card = await this.hydrationService.waitForCard(nextItem.cardID);
      }

      // Remove from source queue now that we're consuming it
      this.removeItemFromQueue(nextItem);

      if (card) {
        // Trigger background hydration to maintain cache (async, non-blocking)
        await this.hydrationService.ensureHydratedCards();
        this._currentCard = card;

        // Record presentation for debugging
        const origin = nextItem.status === 'review' || nextItem.status === 'failed-review' ? 'review' :
                       nextItem.status === 'new' || nextItem.status === 'failed-new' ? 'new' : 'failed';
        const queueSource = nextItem.status.startsWith('failed') ? 'failedQ' :
                           (nextItem.status === 'review' ? 'reviewQ' : 'newQ');

        recordCardPresentation(
          nextItem.cardID,
          nextItem.courseID,
          this.courseNameCache.get(nextItem.courseID),
          origin,
          queueSource as 'reviewQ' | 'newQ' | 'failedQ'
        );

        // Snapshot queue state
        snapshotQueues(this.reviewQ.length, this.newQ.length, this.failedQ.length);

        return card;
      }

      // Card failed hydration (deleted from DB?) — skip and clean up
      this.log(`Skipping card ${nextItem.cardID}: hydration failed, trying next`);
      if (isReview(nextItem)) {
        this.srsService.removeReview(nextItem.reviewID);
      }
    }

    this.log(`Exhausted ${MAX_SKIP} skip attempts finding a hydratable card`);
    this._currentCard = null;
    endSessionTracking();
    return null;
  }

  /**
   * Public API for processing user responses to cards.
   * @param cardRecord User's response record
   * @param cardHistory Promise resolving to the card's history
   * @param courseRegistrationDoc User's course registration document
   * @param currentCard Current study session record
   * @param courseId Course identifier
   * @param cardId Card identifier
   * @param maxAttemptsPerView Maximum attempts allowed per view
   * @param maxSessionViews Maximum session views for this card
   * @param sessionViews Current number of session views
   * @returns ResponseResult with navigation and UI instructions
   */
  public async submitResponse(
    cardRecord: CardRecord,
    cardHistory: Promise<CardHistory<CardRecord>>,
    courseRegistrationDoc: CourseRegistrationDoc,
    currentCard: StudySessionRecord,
    courseId: string,
    cardId: string,
    maxAttemptsPerView: number,
    maxSessionViews: number,
    sessionViews: number
  ): Promise<ResponseResult> {
    const studySessionItem: StudySessionItem = {
      ...currentCard.item,
    };

    return await this.services.response.processResponse(
      cardRecord,
      cardHistory,
      studySessionItem,
      courseRegistrationDoc,
      currentCard,
      courseId,
      cardId,
      maxAttemptsPerView,
      maxSessionViews,
      sessionViews
    );
  }

  private dismissCurrentCard(action: SessionAction = 'dismiss-success') {
    if (this._currentCard) {
      // this.log(`Running dismissCurrentCard on ${this._currentCard!.qualifiedID}`);
      // if (action.includes('dismiss')) {
      //   if (this._currentCard.status === 'review' ||
      //     this._currentCard.status === 'failed-review') {
      //     removeScheduledCardReview(this.user.getUsername(),
      //       (this._currentCard as StudySessionReviewItem).reviewID);
      //     this.log(`Dismissed review card: ${this._currentCard.qualifiedID}`)
      //   }
      // }

      if (action === 'dismiss-success') {
        // Remove from hydration cache to free memory
        this.hydrationService.removeCard(this._currentCard.item.cardID);
        // schedule a review - currently done in Study.vue
      } else if (action === 'marked-failed') {
        // Card stays in hydration cache for re-use (no removeCard call)

        let failedItem: StudySessionFailedItem;

        if (isReview(this._currentCard.item)) {
          failedItem = {
            cardID: this._currentCard.item.cardID,
            courseID: this._currentCard.item.courseID,
            contentSourceID: this._currentCard.item.contentSourceID,
            contentSourceType: this._currentCard.item.contentSourceType,
            status: 'failed-review',
            reviewID: this._currentCard.item.reviewID,
          };
        } else {
          failedItem = {
            cardID: this._currentCard.item.cardID,
            courseID: this._currentCard.item.courseID,
            contentSourceID: this._currentCard.item.contentSourceID,
            contentSourceType: this._currentCard.item.contentSourceType,
            status: 'failed-new',
          };
        }

        this.failedQ.add(failedItem, failedItem.cardID);
      } else if (action === 'dismiss-error') {
        // Remove from cache on error as well
        this.hydrationService.removeCard(this._currentCard.item.cardID);
      } else if (action === 'dismiss-failed') {
        // Remove from cache - card has been fully processed after failure cleanup
        this.hydrationService.removeCard(this._currentCard.item.cardID);
      }
    }
  }

  /**
   * Remove an item from its source queue after consumption by nextCard().
   */
  private removeItemFromQueue(item: StudySessionItem): void {
    // Check each queue - item should be at the front of one of them
    if (this.reviewQ.peek(0)?.cardID === item.cardID) {
      this.reviewQ.dequeue((queueItem) => queueItem.cardID);
    } else if (this.newQ.peek(0)?.cardID === item.cardID) {
      this.newQ.dequeue((queueItem) => queueItem.cardID);
      if (this._wellIndicatedRemaining > 0) {
        this._wellIndicatedRemaining--;
      }
    } else if (this.failedQ.peek(0)?.cardID === item.cardID) {
      this.failedQ.dequeue((queueItem) => queueItem.cardID);
    }
  }

  /**
   * End the session and record learning outcomes.
   *
   * This method aggregates all responses from the session and records a
   * UserOutcomeRecord if evolutionary orchestration is enabled.
   */
  public async endSession(): Promise<void> {
    if (!this._sessionRecord || this._sessionRecord.length === 0) {
      return;
    }

    const questionRecords = this._sessionRecord
      .flatMap((r) => r.records)
      .filter((r): r is QuestionRecord => (r as any).userAnswer !== undefined);

    if (questionRecords.length === 0) {
      return;
    }

    // We need to access the orchestration context.
    // Ideally this would be passed in or available via services.
    // For now, we'll try to get it from one of the content sources if possible,
    // or skip if we can't access it.

    // Try to find a source that supports orchestration
    let orchestrationContext = null;
    const strategies: string[] = [];

    for (const source of this.sources) {
      if (source.getOrchestrationContext) {
        try {
          orchestrationContext = await source.getOrchestrationContext();
          // Also try to get strategy IDs if available on the source (e.g. Pipeline)
          if ((source as any).getStrategyIds) {
            strategies.push(...(source as any).getStrategyIds());
          }
        } catch (e) {
          logger.warn(`[SessionController] Failed to get orchestration context: ${e}`);
        }
        if (orchestrationContext) break;
      }
    }

    if (!orchestrationContext) {
      logger.debug('[SessionController] No orchestration context available, skipping outcome recording');
      return;
    }

    // Use current time as period end
    const periodEnd = new Date().toISOString();
    // Use session start time as period start
    const periodStart = new Date(this.startTime).toISOString();

    await recordUserOutcome(
      orchestrationContext,
      periodStart,
      periodEnd,
      questionRecords,
      strategies
    );
  }
}
