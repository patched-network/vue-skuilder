import { logger } from '../util/logger';

// ============================================================================
// SESSION DEBUGGER
// ============================================================================
//
// Console-accessible debug API for inspecting session runtime behavior.
//
// Exposed as `window.skuilder.session` for interactive exploration.
//
// Usage:
//   window.skuilder.session.showQueue()
//   window.skuilder.session.showHistory()
//   window.skuilder.session.showInterleaving()
//   window.skuilder.session.export()
//
// ============================================================================

/**
 * Snapshot of queue state at a given moment.
 */
export interface QueueSnapshot {
  timestamp: Date;
  reviewQLength: number;
  newQLength: number;
  failedQLength: number;
  reviewQNext3?: string[]; // cardIds of next 3 in reviewQ
  newQNext3?: string[]; // cardIds of next 3 in newQ
}

/**
 * Record of a single card presentation.
 */
export interface CardPresentation {
  timestamp: Date;
  sequenceNumber: number; // 1-indexed position in session
  cardId: string;
  courseId: string;
  courseName?: string;
  origin: 'review' | 'new' | 'failed';
  queueSource: 'reviewQ' | 'newQ' | 'failedQ';
  score?: number; // If available from weighted cards
}

/**
 * Complete session execution record.
 */
export interface SessionRunReport {
  sessionId: string;
  startTime: Date;
  endTime?: Date;

  // Initial state
  initialQueues: QueueSnapshot;

  // Card presentations in order
  presentations: CardPresentation[];

  // Queue snapshots at various points
  queueSnapshots: QueueSnapshot[];
}

/**
 * Active session state.
 */
let activeSession: SessionRunReport | null = null;
const sessionHistory: SessionRunReport[] = [];
const MAX_HISTORY = 5;

/**
 * Start tracking a new session.
 */
export function startSessionTracking(
  reviewQLength: number,
  newQLength: number,
  failedQLength: number
): void {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  activeSession = {
    sessionId,
    startTime: new Date(),
    initialQueues: {
      timestamp: new Date(),
      reviewQLength,
      newQLength,
      failedQLength,
    },
    presentations: [],
    queueSnapshots: [],
  };

  logger.debug(`[SessionDebugger] Started tracking session: ${sessionId}`);
}

/**
 * Record a card presentation.
 */
export function recordCardPresentation(
  cardId: string,
  courseId: string,
  courseName: string | undefined,
  origin: 'review' | 'new' | 'failed',
  queueSource: 'reviewQ' | 'newQ' | 'failedQ',
  score?: number
): void {
  if (!activeSession) {
    logger.warn('[SessionDebugger] No active session to record presentation');
    return;
  }

  activeSession.presentations.push({
    timestamp: new Date(),
    sequenceNumber: activeSession.presentations.length + 1,
    cardId,
    courseId,
    courseName,
    origin,
    queueSource,
    score,
  });
}

/**
 * Take a snapshot of current queue state.
 */
export function snapshotQueues(
  reviewQLength: number,
  newQLength: number,
  failedQLength: number,
  reviewQNext3?: string[],
  newQNext3?: string[]
): void {
  if (!activeSession) {
    return;
  }

  activeSession.queueSnapshots.push({
    timestamp: new Date(),
    reviewQLength,
    newQLength,
    failedQLength,
    reviewQNext3,
    newQNext3,
  });
}

/**
 * End the current session tracking.
 */
export function endSessionTracking(): void {
  if (!activeSession) {
    return;
  }

  activeSession.endTime = new Date();

  // Add to history
  sessionHistory.unshift(activeSession);
  if (sessionHistory.length > MAX_HISTORY) {
    sessionHistory.pop();
  }

  logger.debug(`[SessionDebugger] Ended session: ${activeSession.sessionId}`);
  activeSession = null;
}

// ============================================================================
// CONSOLE API
// ============================================================================

/**
 * Show current queue state (if session active).
 */
function showCurrentQueue(): void {
  if (!activeSession) {
    logger.info('[Session Debug] No active session.');
    return;
  }

  const latest = activeSession.queueSnapshots[activeSession.queueSnapshots.length - 1] || activeSession.initialQueues;

  // eslint-disable-next-line no-console
  console.group('📊 Current Queue State');
  logger.info(`Review Queue: ${latest.reviewQLength} cards`);
  if (latest.reviewQNext3 && latest.reviewQNext3.length > 0) {
    logger.info(`  Next: ${latest.reviewQNext3.join(', ')}`);
  }
  logger.info(`New Queue: ${latest.newQLength} cards`);
  if (latest.newQNext3 && latest.newQNext3.length > 0) {
    logger.info(`  Next: ${latest.newQNext3.join(', ')}`);
  }
  logger.info(`Failed Queue: ${latest.failedQLength} cards`);
  // eslint-disable-next-line no-console
  console.groupEnd();
}

/**
 * Show presentation history for current or last session.
 */
function showPresentationHistory(sessionIndex: number = 0): void {
  const session = sessionIndex === 0 && activeSession ? activeSession : sessionHistory[sessionIndex];

  if (!session) {
    logger.info(`[Session Debug] No session found at index ${sessionIndex}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.group(`📜 Session History: ${session.sessionId}`);
  logger.info(`Started: ${session.startTime.toLocaleTimeString()}`);
  if (session.endTime) {
    logger.info(`Ended: ${session.endTime.toLocaleTimeString()}`);
  }
  logger.info(`Cards presented: ${session.presentations.length}`);

  if (session.presentations.length > 0) {
    // eslint-disable-next-line no-console
    console.table(
      session.presentations.map((p) => ({
        '#': p.sequenceNumber,
        course: p.courseName || p.courseId.slice(0, 8),
        origin: p.origin,
        queue: p.queueSource,
        score: p.score?.toFixed(3) || '-',
        time: p.timestamp.toLocaleTimeString(),
      }))
    );
  }

  // eslint-disable-next-line no-console
  console.groupEnd();
}

/**
 * Analyze course interleaving pattern.
 */
function showInterleaving(sessionIndex: number = 0): void {
  const session = sessionIndex === 0 && activeSession ? activeSession : sessionHistory[sessionIndex];

  if (!session) {
    logger.info(`[Session Debug] No session found at index ${sessionIndex}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.group('🔀 Interleaving Analysis');

  // Course distribution
  const courseCounts = new Map<string, number>();
  const courseOrigins = new Map<string, { review: number; new: number; failed: number }>();

  session.presentations.forEach((p) => {
    const name = p.courseName || p.courseId;
    courseCounts.set(name, (courseCounts.get(name) || 0) + 1);

    if (!courseOrigins.has(name)) {
      courseOrigins.set(name, { review: 0, new: 0, failed: 0 });
    }
    const origins = courseOrigins.get(name)!;
    origins[p.origin]++;
  });

  logger.info('Course distribution:');
  // eslint-disable-next-line no-console
  console.table(
    Array.from(courseCounts.entries()).map(([course, count]) => {
      const origins = courseOrigins.get(course)!;
      return {
        course,
        total: count,
        reviews: origins.review,
        new: origins.new,
        failed: origins.failed,
        percentage: ((count / session.presentations.length) * 100).toFixed(1) + '%',
      };
    })
  );

  // Show interleaving pattern (first 20 cards)
  if (session.presentations.length > 0) {
    logger.info('\nPresentation sequence (first 20):');
    const sequence = session.presentations
      .slice(0, 20)
      .map((p, idx) => `${idx + 1}. ${p.courseName || p.courseId.slice(0, 8)} (${p.origin})`)
      .join('\n');
    logger.info(sequence);
  }

  // Detect clustering (same course in a row)
  let maxCluster = 0;
  let currentCluster = 1;
  let currentCourse = session.presentations[0]?.courseId;

  for (let i = 1; i < session.presentations.length; i++) {
    if (session.presentations[i].courseId === currentCourse) {
      currentCluster++;
      maxCluster = Math.max(maxCluster, currentCluster);
    } else {
      currentCourse = session.presentations[i].courseId;
      currentCluster = 1;
    }
  }

  if (maxCluster > 3) {
    logger.info(`\n⚠️ Detected clustering: max ${maxCluster} cards from same course in a row`);
    logger.info('This suggests cards are sorted by score rather than round-robin by course.');
  }

  // eslint-disable-next-line no-console
  console.groupEnd();
}

/**
 * Console API object exposed on window.skuilder.session
 */
export const sessionDebugAPI = {
  /**
   * Get raw session history for programmatic access.
   */
  get sessions(): SessionRunReport[] {
    return [...sessionHistory];
  },

  /**
   * Get active session if any.
   */
  get active(): SessionRunReport | null {
    return activeSession;
  },

  /**
   * Show current queue state.
   */
  showQueue(): void {
    showCurrentQueue();
  },

  /**
   * Show presentation history for current or past session.
   */
  showHistory(sessionIndex: number = 0): void {
    showPresentationHistory(sessionIndex);
  },

  /**
   * Analyze course interleaving pattern.
   */
  showInterleaving(sessionIndex: number = 0): void {
    showInterleaving(sessionIndex);
  },

  /**
   * List all tracked sessions.
   */
  listSessions(): void {
    if (activeSession) {
      logger.info(`Active session: ${activeSession.sessionId} (${activeSession.presentations.length} cards presented)`);
    }

    if (sessionHistory.length === 0) {
      logger.info('[Session Debug] No completed sessions in history.');
      return;
    }

    // eslint-disable-next-line no-console
    console.table(
      sessionHistory.map((s, idx) => ({
        index: idx,
        id: s.sessionId.slice(-8),
        started: s.startTime.toLocaleTimeString(),
        ended: s.endTime?.toLocaleTimeString() || 'incomplete',
        cards: s.presentations.length,
      }))
    );
  },

  /**
   * Export session history as JSON for bug reports.
   */
  export(): string {
    const data = {
      active: activeSession,
      history: sessionHistory,
    };
    const json = JSON.stringify(data, null, 2);
    logger.info('[Session Debug] Session data exported. Copy the returned string or use:');
    logger.info('  copy(window.skuilder.session.export())');
    return json;
  },

  /**
   * Clear session history.
   */
  clear(): void {
    sessionHistory.length = 0;
    logger.info('[Session Debug] Session history cleared.');
  },

  /**
   * Show help.
   */
  help(): void {
    logger.info(`
🎯 Session Debug API

Commands:
  .showQueue()              Show current queue state (active session only)
  .showHistory(index?)      Show presentation history (0=current/last, 1=previous, etc)
  .showInterleaving(index?) Analyze course interleaving pattern
  .listSessions()           List all tracked sessions
  .export()                 Export session data as JSON for bug reports
  .clear()                  Clear session history
  .sessions                 Access raw session history array
  .active                   Access active session (if any)
  .help()                   Show this help message

Example:
  window.skuilder.session.showHistory()
  window.skuilder.session.showInterleaving()
  window.skuilder.session.showQueue()
`);
  },
};

// ============================================================================
// WINDOW MOUNT
// ============================================================================

/**
 * Mount the debug API on window.skuilder.session
 */
export function mountSessionDebugger(): void {
  if (typeof window === 'undefined') return;

  const win = window as any;
  win.skuilder = win.skuilder || {};
  win.skuilder.session = sessionDebugAPI;
}

// Auto-mount when module is loaded
mountSessionDebugger();
