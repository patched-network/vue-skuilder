import { logger } from '../util/logger';
import type { ReplanHints } from '@db/core/navigators/generators/types';
import type { SrsBacklogDebug } from '@db/core/navigators/SrsDebugger';

// ============================================================================
// SESSION OVERLAY
// ============================================================================
//
// A pinned, vanilla-DOM debug overlay for the LIVE SessionController. Unlike
// `SessionDebugger` (a passive tracker of pushed snapshots), this reads the
// active controller directly each tick — current queues, session hints, timer.
//
// Toggled via `window.skuilder.session.dbgOverlay()`.
//
// The `db` package is framework-agnostic, so this renders with raw DOM and
// no-ops gracefully in non-browser hosts (e.g. the tuilder TUI). It is the
// first DOM-rendering debug util in the package — kept self-contained here.
//
// ============================================================================

/** A single queued item, carrying the now-load-bearing rank score + origin. */
export interface SessionQueueItemDebug {
  cardID: string;
  /** Item status: 'new' | 'review' | 'failed-new' | 'failed-review'. */
  status: string;
  /** Card nature, collapsed from status: 'new' | 'review'. */
  origin: 'new' | 'review';
  /** Pipeline suitability score at queue-build time; `+INF` marks a required card. */
  score?: number;
}

/** Per-queue debug view: total length, cumulative draws, and head-first items. */
export interface SessionQueueDebug {
  length: number;
  dequeueCount: number;
  /** Items in queue order, head (next draw) first. */
  cards: SessionQueueItemDebug[];
}

/**
 * A card the learner has interacted with this session (one entry per card in
 * the session record, regardless of which queue — if any — still holds it).
 */
export interface SessionDrawnCardDebug {
  cardID: string;
  /** Queue status at draw time: 'new' | 'review' | 'failed-new' | 'failed-review'. */
  status: string;
  /** Number of CardRecords logged for this card this session (≥1). */
  attempts: number;
  /** Latest record's correctness; null for non-question (info) records. */
  correct: boolean | null;
  /** Total time spent across all of this card's records, in ms. */
  timeSpentMs: number;
}

/** Live snapshot of the controller, read fresh on each overlay tick. */
export interface SessionDebugSnapshot {
  secondsRemaining: number;
  hasCardGuarantee: boolean;
  minCardsGuarantee: number;
  wellIndicatedRemaining: number;
  /** cardID of the card currently in front of the learner, if any. */
  currentCard: string | null;
  /** Session-durable hints re-merged into every pipeline run this session. */
  sessionHints: ReplanHints | null;
  /** True while a replan is executing (in-flight). */
  replanActive: boolean;
  /** Reason for the in-flight replan (caller label, or '(auto)'); may be stale when idle. */
  replanLabel: string | null;
  /** The single rank-ordered supply (new + review interleaved), head first. */
  supplyQ: SessionQueueDebug;
  failedQ: SessionQueueDebug;
  /** SRS backlog state per course (drives the "is review starvation permanent?" read). */
  reviewBacklog: SrsBacklogDebug[];
  /** Every card the learner has interacted with this session, draw order. */
  drawnCards: SessionDrawnCardDebug[];
}

/** The narrow surface the overlay needs from a SessionController. */
export interface SessionDebugTarget {
  getDebugSnapshot(): SessionDebugSnapshot;
}

/**
 * The live-session surface available to out-of-tree callers through the
 * active-controller registry: the debug snapshot, plus the small set of
 * user-facing session controls a view may need without holding a ref into
 * the `<StudySession>` component's internals (e.g. wiring a timer's
 * add-time button from a composable). Keep this narrow — it is not a
 * general escape hatch to `SessionController`.
 */
export interface ActiveSessionHandle extends SessionDebugTarget {
  /** Extend the session clock by `seconds`. */
  addTime(seconds: number): void;
}

// ----------------------------------------------------------------------------
// Active-controller registry
// ----------------------------------------------------------------------------
//
// The controller registers itself on construction; a new session overwrites the
// prior handle. Kept here (a leaf module) so SessionController can import the
// registrar without pulling in the overlay's DOM code or risking an import
// cycle with SessionDebugger.

let activeController: ActiveSessionHandle | null = null;

/** Called by SessionController's constructor. Pass `null` to deregister. */
export function registerActiveController(controller: ActiveSessionHandle | null): void {
  activeController = controller;
}

export function getActiveController(): ActiveSessionHandle | null {
  return activeController;
}

// ----------------------------------------------------------------------------
// Overlay rendering (vanilla DOM)
// ----------------------------------------------------------------------------

const OVERLAY_ID = 'skuilder-session-overlay';
const POLL_MS = 300;
/**
 * Cap on how many cards a queue lists by default. Queues at or below this show
 * in full; larger ones show the first INLINE_THRESHOLD then a clickable
 * "… +N more" affordance that expands to the full list (and back).
 */
const INLINE_THRESHOLD = 5;

/** Braille spinner frames, advanced once per render tick (≈POLL_MS cadence). */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerFrame = 0;

let overlayEl: HTMLElement | null = null;
let pollHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Most recent snapshot rendered, retained so the click-to-copy button can
 * serialise exactly what is on screen at click time (decoupled from the poll).
 */
let lastSnapshot: SessionDebugSnapshot | null = null;

/** Epoch ms until which the copy button shows its "copied" confirmation. */
let copyFlashUntil = 0;

/**
 * When minified, the overlay collapses to just its header bar (title + copy +
 * restore button), suppressing all body sections. The poll keeps running so
 * `lastSnapshot` — and therefore the copy button — stays current underneath.
 */
let minified = false;

/** Expansion state for collapsible (large) lists, preserved across re-renders. */
const expanded: Record<string, boolean> = {
  supplyQ: false,
  failedQ: false,
  drawn: false,
};

/**
 * Toggle the pinned overlay on/off. No-ops (with a console hint) when there is
 * no DOM, so it is safe to call from any host environment.
 */
export function toggleSessionOverlay(): void {
  if (typeof document === 'undefined') {
    logger.info('[Session Overlay] No DOM available (non-browser host); overlay unavailable.');
    return;
  }
  if (overlayEl) {
    teardown();
    logger.info('[Session Overlay] Hidden.');
  } else {
    mount();
    logger.info('[Session Overlay] Shown. Toggle off with window.skuilder.session.dbgOverlay().');
  }
}

function mount(): void {
  minified = false;
  overlayEl = document.createElement('div');
  overlayEl.id = OVERLAY_ID;
  Object.assign(overlayEl.style, {
    position: 'fixed',
    top: '8px',
    left: '8px',
    zIndex: '2147483647',
    maxWidth: '320px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '8px 10px',
    background: 'rgba(17, 24, 39, 0.92)',
    color: '#e5e7eb',
    font: '11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
    borderRadius: '6px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    pointerEvents: 'auto',
    userSelect: 'none',
  });
  document.body.appendChild(overlayEl);
  render();
  pollHandle = setInterval(render, POLL_MS);
}

function teardown(): void {
  if (pollHandle !== null) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  if (overlayEl?.parentNode) {
    overlayEl.parentNode.removeChild(overlayEl);
  }
  overlayEl = null;
}

function render(): void {
  if (!overlayEl) return;

  spinnerFrame++;

  const ctrl = getActiveController();
  if (!ctrl) {
    lastSnapshot = null;
    overlayEl.innerHTML =
      headerHtml() + (minified ? '' : `<div style="opacity:.65">No active session.</div>`);
    attachHandlers();
    return;
  }

  const s = ctrl.getDebugSnapshot();
  lastSnapshot = s;

  if (minified) {
    overlayEl.innerHTML = headerHtml();
    attachHandlers();
    return;
  }

  overlayEl.innerHTML =
    headerHtml() +
    replanHtml(s) +
    metaHtml(s) +
    hintsHtml(s.sessionHints) +
    backlogHtml(s.reviewBacklog) +
    queueHtml('supplyQ', 'supplyQ', s.supplyQ) +
    queueHtml('failedQ', 'failedQ', s.failedQ) +
    drawnHtml('drawn', s.drawnCards);

  attachHandlers();
}

/** (Re-)bind click handlers after each innerHTML rewrite. */
function attachHandlers(): void {
  if (!overlayEl) return;

  // Toggle handlers for collapsible queue / drawn-list headers and footers.
  overlayEl.querySelectorAll<HTMLElement>('[data-q]').forEach((el) => {
    el.onclick = () => {
      const key = el.dataset.q;
      if (!key) return;
      expanded[key] = !expanded[key];
      render();
    };
  });

  // Global click-to-copy: dump the currently-displayed snapshot as plain text.
  const copyBtn = overlayEl.querySelector<HTMLElement>('[data-copy]');
  if (copyBtn) {
    copyBtn.onclick = (ev) => {
      ev.stopPropagation();
      copySnapshot();
    };
  }

  // Minify / restore: collapse the overlay to its header bar and back.
  const minBtn = overlayEl.querySelector<HTMLElement>('[data-min]');
  if (minBtn) {
    minBtn.onclick = (ev) => {
      ev.stopPropagation();
      minified = !minified;
      render();
    };
  }
}

/** Serialise the on-screen snapshot to the clipboard, with a transient flash. */
function copySnapshot(): void {
  const text = snapshotToText(lastSnapshot);
  const flash = () => {
    copyFlashUntil = Date.now() + 1200;
    render();
  };
  const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (clip?.writeText) {
    clip.writeText(text).then(flash, (err) => {
      logger.warn(`[Session Overlay] Clipboard write failed: ${String(err)}`);
    });
  } else {
    logger.info(`[Session Overlay] Clipboard unavailable; snapshot follows:\n${text}`);
  }
}

function headerHtml(): string {
  const flashing = Date.now() < copyFlashUntil;
  const btnLabel = flashing ? '✓ copied' : '⎘ copy';
  const btnColor = flashing ? '#86efac' : '#93c5fd';
  const copyBtn =
    `<span data-copy style="cursor:pointer;float:right;font-weight:400;` +
    `color:${btnColor};border:1px solid currentColor;border-radius:4px;` +
    `padding:0 4px;line-height:1.3">${btnLabel}</span>`;
  const minBtn =
    `<span data-min title="${minified ? 'Restore' : 'Minify'}" ` +
    `style="cursor:pointer;float:right;font-weight:400;color:#93c5fd;` +
    `border:1px solid currentColor;border-radius:4px;padding:0 5px;` +
    `margin-right:4px;line-height:1.3">${minified ? '▢' : '—'}</span>`;
  return (
    `<div style="font-weight:600;color:#93c5fd;margin-bottom:${minified ? 0 : 4}px">` +
    `${copyBtn}${minBtn}⚙ SessionController</div>`
  );
}

function replanHtml(s: SessionDebugSnapshot): string {
  if (!s.replanActive) {
    return `<div style="margin-bottom:6px;opacity:.45">○ idle</div>`;
  }
  const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
  const reason = esc(s.replanLabel ?? '(auto)');
  return (
    `<div style="margin-bottom:6px;color:#fde047">` +
    `${frame} replanning <span style="opacity:.85">[${reason}]</span></div>`
  );
}

function metaHtml(s: SessionDebugSnapshot): string {
  const mmss = formatTime(s.secondsRemaining);
  const guarantee = s.hasCardGuarantee
    ? ` · <span style="color:#fbbf24">guarantee ${s.minCardsGuarantee}</span>`
    : '';
  const rows = [
    `time ${mmss}${guarantee}`,
    `well-indicated left: ${s.wellIndicatedRemaining}`,
    `current: ${s.currentCard ? esc(s.currentCard) : '<span style="opacity:.6">—</span>'}`,
  ];
  return `<div style="margin-bottom:6px">${rows.map((r) => `<div>${r}</div>`).join('')}</div>`;
}

function hintsHtml(h: ReplanHints | null): string {
  const parts: string[] = [];
  if (h) {
    if (h.boostTags && Object.keys(h.boostTags).length) {
      parts.push(
        `boost: ` +
          Object.entries(h.boostTags)
            .map(([k, v]) => `${esc(k)}<span style="opacity:.6">×${v}</span>`)
            .join(', ')
      );
    }
    if (h.boostCards && Object.keys(h.boostCards).length) {
      parts.push(
        `boostCards: ` +
          Object.entries(h.boostCards)
            .map(([k, v]) => `${esc(k)}<span style="opacity:.6">×${v}</span>`)
            .join(', ')
      );
    }
    if (h.requireCards?.length) parts.push(`require: ${h.requireCards.map(esc).join(', ')}`);
    if (h.requireTags?.length) parts.push(`requireTags: ${h.requireTags.map(esc).join(', ')}`);
    if (h.excludeTags?.length) parts.push(`exclude: ${h.excludeTags.map(esc).join(', ')}`);
    if (h.excludeCards?.length) parts.push(`excludeCards: ${h.excludeCards.map(esc).join(', ')}`);
  }
  const body = parts.length
    ? parts.map((p) => `<div style="margin-left:6px">${p}</div>`).join('')
    : `<div style="margin-left:6px;opacity:.6">none</div>`;
  return (
    `<div style="margin-bottom:6px">` +
    `<div style="color:#86efac">sessionHints</div>${body}</div>`
  );
}

/**
 * SRS backlog panel — answers "is review starvation permanent?". Backlog
 * pressure is a multiplier (×1.0 healthy → exponential, uncapped) on review
 * urgency; reviews are no longer clamped to 1.0, so under a heavy backlog they
 * scale up to compete with (and exceed) new cards. There's no ceiling, so
 * reviews always win eventually — the panel shows how far the current
 * multiplier is from that crossover, not whether it's "maxed": compare
 * `top review` here against the supplyQ head score to see how much further
 * the backlog needs to grow (or the boosts need to relax) before reviews win
 * slots.
 */
function backlogHtml(backlog: SrsBacklogDebug[]): string {
  if (!backlog.length) return '';
  const rows = backlog
    .map((b) => {
      const hot = b.backlogMultiplier >= 3;
      const multColor = b.backlogMultiplier <= 1 ? '#86efac' : hot ? '#fca5a5' : '#fcd34d';
      const headroom =
        b.backlogMultiplier > 1
          ? `climbing (×${b.backlogGrowthRate.toFixed(2)} per ${b.healthyBacklog}-review excess, unbounded)`
          : 'healthy — no pressure';
      const top = b.topReviewScore !== null ? b.topReviewScore.toFixed(2) : '—';
      const next = b.nextDueIn ? ` <span style="opacity:.6">· next due ${esc(b.nextDueIn)}</span>` : '';
      return (
        `<div style="margin-left:6px">` +
        `<span style="opacity:.7">${esc(b.courseId.slice(0, 8))}</span> ` +
        `due ${b.dueNow}/${b.scheduledTotal} <span style="opacity:.6">(healthy ${b.healthyBacklog})</span>${next}` +
        `<div style="margin-left:6px">` +
        `pressure <span style="color:${multColor}">×${b.backlogMultiplier.toFixed(2)}</span> ` +
        `<span style="opacity:.6">${headroom} · top review ${top}</span></div>` +
        `</div>`
      );
    })
    .join('');
  return (
    `<div style="margin-bottom:6px">` +
    `<div style="color:#93c5fd">review backpressure</div>${rows}</div>`
  );
}

/** Format a rank score for display: finite → 2dp, `+INF` → REQ (required). */
function fmtScore(score?: number): string {
  if (score === undefined) return '';
  if (!Number.isFinite(score)) return 'REQ';
  return score.toFixed(2);
}

/** One supply/failed queue line: `cardID [r 0.82]` with origin-coloured tag. */
function queueItemHtml(item: SessionQueueItemDebug): string {
  const tagColor = item.origin === 'review' ? '#93c5fd' : '#fcd34d';
  const score = fmtScore(item.score);
  const label = `${item.origin === 'review' ? 'r' : 'n'}${score ? ' ' + score : ''}`;
  return (
    `${esc(item.cardID)}` +
    `<span style="color:${tagColor};opacity:.85"> [${label}]</span>`
  );
}

function queueHtml(key: string, label: string, q: SessionQueueDebug): string {
  const collapsible = q.length > INLINE_THRESHOLD;
  const isOpen = collapsible && expanded[key];
  const caret = collapsible ? (expanded[key] ? '▾ ' : '▸ ') : '';
  const drawn = q.dequeueCount ? ` <span style="opacity:.5">drawn ${q.dequeueCount}</span>` : '';
  const titleStyle = collapsible ? 'cursor:pointer;color:#f9a8d4' : 'color:#f9a8d4';
  const titleAttr = collapsible ? ` data-q="${key}"` : '';
  const title = `<div${titleAttr} style="${titleStyle}">${caret}${label}: ${q.length}${drawn}</div>`;

  if (!q.cards.length) {
    return title + `<div style="margin:1px 0 6px 6px;opacity:.5">empty</div>`;
  }

  // Always list up to INLINE_THRESHOLD cards; the remainder hides behind an
  // expand toggle so long queues never blow out the overlay but stay inspectable.
  const shown = isOpen ? q.cards : q.cards.slice(0, INLINE_THRESHOLD);
  const hiddenCount = q.length - shown.length;
  const listMarginBottom = collapsible ? 2 : 6;

  let body =
    `<ol style="margin:2px 0 ${listMarginBottom}px 0;padding-left:20px">` +
    shown.map((c) => `<li style="white-space:nowrap">${queueItemHtml(c)}</li>`).join('') +
    `</ol>`;

  if (collapsible) {
    const footer = isOpen ? '▾ show less' : `… +${hiddenCount} more`;
    body += `<div data-q="${key}" style="cursor:pointer;margin:0 0 6px 20px;opacity:.6">${footer}</div>`;
  }

  return title + body;
}

/** Compact, colour-coded per-card glyph: ✓ correct, ✗ wrong, · info-only. */
function outcomeGlyph(correct: boolean | null): string {
  if (correct === true) return `<span style="color:#86efac">✓</span>`;
  if (correct === false) return `<span style="color:#fca5a5">✗</span>`;
  return `<span style="opacity:.5">·</span>`;
}

/**
 * Expandable list of every card the learner has interacted with this session.
 * Mirrors `queueHtml`'s collapse behaviour but renders richer per-card detail
 * (status, outcome, attempt count) since this is the audit trail, not a queue.
 */
function drawnHtml(key: string, drawn: SessionDrawnCardDebug[]): string {
  const collapsible = drawn.length > INLINE_THRESHOLD;
  const isOpen = collapsible && expanded[key];
  const caret = collapsible ? (expanded[key] ? '▾ ' : '▸ ') : '';
  const titleStyle = collapsible ? 'cursor:pointer;color:#c4b5fd' : 'color:#c4b5fd';
  const titleAttr = collapsible ? ` data-q="${key}"` : '';
  const title = `<div${titleAttr} style="${titleStyle}">${caret}drawn: ${drawn.length}</div>`;

  if (!drawn.length) {
    return title + `<div style="margin:1px 0 6px 6px;opacity:.5">none yet</div>`;
  }

  const shown = isOpen ? drawn : drawn.slice(0, INLINE_THRESHOLD);
  const hiddenCount = drawn.length - shown.length;
  const listMarginBottom = collapsible ? 2 : 6;

  const rows = shown
    .map((d) => {
      const retries = d.attempts > 1 ? `<span style="opacity:.5"> ×${d.attempts}</span>` : '';
      const time = `<span style="opacity:.45"> ${Math.round(d.timeSpentMs / 100) / 10}s</span>`;
      return (
        `<li style="white-space:nowrap">${outcomeGlyph(d.correct)} ${esc(d.cardID)}` +
        `<span style="opacity:.5"> [${esc(d.status)}]</span>${retries}${time}</li>`
      );
    })
    .join('');

  let body = `<ol style="margin:2px 0 ${listMarginBottom}px 0;padding-left:20px">${rows}</ol>`;

  if (collapsible) {
    const footer = isOpen ? '▾ show less' : `… +${hiddenCount} more`;
    body += `<div data-q="${key}" style="cursor:pointer;margin:0 0 6px 20px;opacity:.6">${footer}</div>`;
  }

  return title + body;
}

/**
 * Plain-text rendering of a snapshot for the clipboard. Mirrors the on-screen
 * sections (without truncation) so a copied dump is a complete, paste-able
 * picture of session state at the moment of the click.
 */
function snapshotToText(s: SessionDebugSnapshot | null): string {
  if (!s) return 'SessionController — no active session.';

  const lines: string[] = [];
  lines.push('=== SessionController ===');
  lines.push(`time ${formatTime(s.secondsRemaining)}`);
  if (s.hasCardGuarantee) lines.push(`guarantee: ${s.minCardsGuarantee}`);
  lines.push(`well-indicated left: ${s.wellIndicatedRemaining}`);
  lines.push(`current: ${s.currentCard ?? '—'}`);
  lines.push(
    s.replanActive ? `replan: ACTIVE [${s.replanLabel ?? '(auto)'}]` : 'replan: idle'
  );

  lines.push('');
  lines.push('sessionHints:');
  const h = s.sessionHints;
  const hintParts: string[] = [];
  if (h) {
    if (h.boostTags && Object.keys(h.boostTags).length)
      hintParts.push(`  boost: ${Object.entries(h.boostTags).map(([k, v]) => `${k}×${v}`).join(', ')}`);
    if (h.boostCards && Object.keys(h.boostCards).length)
      hintParts.push(`  boostCards: ${Object.entries(h.boostCards).map(([k, v]) => `${k}×${v}`).join(', ')}`);
    if (h.requireCards?.length) hintParts.push(`  require: ${h.requireCards.join(', ')}`);
    if (h.requireTags?.length) hintParts.push(`  requireTags: ${h.requireTags.join(', ')}`);
    if (h.excludeTags?.length) hintParts.push(`  exclude: ${h.excludeTags.join(', ')}`);
    if (h.excludeCards?.length) hintParts.push(`  excludeCards: ${h.excludeCards.join(', ')}`);
  }
  lines.push(hintParts.length ? hintParts.join('\n') : '  none');

  if (s.reviewBacklog.length) {
    lines.push('');
    lines.push('review backpressure:');
    for (const b of s.reviewBacklog) {
      const headroom = b.backlogMultiplier > 1 ? 'climbing' : 'healthy';
      const top = b.topReviewScore !== null ? b.topReviewScore.toFixed(2) : '—';
      const next = b.nextDueIn ? `, next due ${b.nextDueIn}` : '';
      lines.push(
        `  ${b.courseId.slice(0, 8)}: due ${b.dueNow}/${b.scheduledTotal} ` +
          `(healthy ${b.healthyBacklog})${next}; pressure ×${b.backlogMultiplier.toFixed(2)} ` +
          `${headroom}; top review ${top}`
      );
    }
  }

  const queueText = (label: string, q: SessionQueueDebug) => {
    lines.push('');
    lines.push(`${label}: ${q.length} (drawn ${q.dequeueCount})`);
    q.cards.forEach((c, i) => {
      const score = fmtScore(c.score);
      const tag = `${c.origin === 'review' ? 'r' : 'n'}${score ? ' ' + score : ''}`;
      lines.push(`  ${i + 1}. ${c.cardID} [${tag}]`);
    });
  };
  queueText('supplyQ', s.supplyQ);
  queueText('failedQ', s.failedQ);

  lines.push('');
  lines.push(`drawn: ${s.drawnCards.length}`);
  s.drawnCards.forEach((d, i) => {
    const mark = d.correct === true ? '✓' : d.correct === false ? '✗' : '·';
    const time = `${Math.round(d.timeSpentMs / 100) / 10}s`;
    lines.push(`  ${i + 1}. ${mark} ${d.cardID} [${d.status}] ×${d.attempts} ${time}`);
  });

  return lines.join('\n');
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
