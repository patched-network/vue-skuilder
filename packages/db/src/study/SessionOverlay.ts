import { logger } from '../util/logger';
import type { ReplanHints } from '@db/core/navigators/generators/types';

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

/** Per-queue debug view: total length, cumulative draws, and head-first cardIDs. */
export interface SessionQueueDebug {
  length: number;
  dequeueCount: number;
  /** cardIDs in queue order, head (next draw) first. */
  cards: string[];
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
  reviewQ: SessionQueueDebug;
  newQ: SessionQueueDebug;
  failedQ: SessionQueueDebug;
}

/** The narrow surface the overlay needs from a SessionController. */
export interface SessionDebugTarget {
  getDebugSnapshot(): SessionDebugSnapshot;
}

// ----------------------------------------------------------------------------
// Active-controller registry
// ----------------------------------------------------------------------------
//
// The controller registers itself on construction; a new session overwrites the
// prior handle. Kept here (a leaf module) so SessionController can import the
// registrar without pulling in the overlay's DOM code or risking an import
// cycle with SessionDebugger.

let activeController: SessionDebugTarget | null = null;

/** Called by SessionController's constructor. Pass `null` to deregister. */
export function registerActiveController(controller: SessionDebugTarget | null): void {
  activeController = controller;
}

export function getActiveController(): SessionDebugTarget | null {
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

/** Expansion state for collapsible (large) queues, preserved across re-renders. */
const expanded: Record<string, boolean> = { reviewQ: false, newQ: false, failedQ: false };

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
    overlayEl.innerHTML = headerHtml() + `<div style="opacity:.65">No active session.</div>`;
    return;
  }

  const s = ctrl.getDebugSnapshot();
  overlayEl.innerHTML =
    headerHtml() +
    replanHtml(s) +
    metaHtml(s) +
    hintsHtml(s.sessionHints) +
    queueHtml('reviewQ', 'reviewQ', s.reviewQ) +
    queueHtml('newQ', 'newQ', s.newQ) +
    queueHtml('failedQ', 'failedQ', s.failedQ);

  // Re-attach toggle handlers for collapsible queue headers each render.
  overlayEl.querySelectorAll<HTMLElement>('[data-q]').forEach((el) => {
    el.onclick = () => {
      const key = el.dataset.q;
      if (!key) return;
      expanded[key] = !expanded[key];
      render();
    };
  });
}

function headerHtml(): string {
  return `<div style="font-weight:600;color:#93c5fd;margin-bottom:4px">⚙ SessionController</div>`;
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
    shown.map((c) => `<li style="white-space:nowrap">${esc(c)}</li>`).join('') +
    `</ol>`;

  if (collapsible) {
    const footer = isOpen ? '▾ show less' : `… +${hiddenCount} more`;
    body += `<div data-q="${key}" style="cursor:pointer;margin:0 0 6px 20px;opacity:.6">${footer}</div>`;
  }

  return title + body;
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
