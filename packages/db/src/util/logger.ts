/**
 * Simple logging utility for @vue-skuilder/db package
 *
 * Level-gated logging with ESLint suppressions to resolve console statement
 * violations while maintaining logging functionality.
 *
 * Level resolution:
 * - Browser: `localStorage['sk.logLevel']`, else `warn`. Change it live (and
 *   persistently) with `window.skuilder.logLevel('info')`.
 * - Node: `SK_LOG_LEVEL`, else `debug` when NODE_ENV=development, else `info`
 *   (CLI tools report progress through `info`).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
const STORAGE_KEY = 'sk.logLevel';

const isBrowser = typeof window !== 'undefined';

function isLevel(v: unknown): v is LogLevel {
  return typeof v === 'string' && v in LEVELS;
}

function initialLevel(): LogLevel {
  if (isBrowser) {
    try {
      const stored = window.localStorage?.getItem(STORAGE_KEY);
      if (isLevel(stored)) return stored;
    } catch {
      // storage blocked (private mode, sandboxed iframe) - fall through
    }
    return 'warn';
  }
  if (typeof process !== 'undefined') {
    const env = process.env.SK_LOG_LEVEL;
    if (isLevel(env)) return env;
    if (process.env.NODE_ENV === 'development') return 'debug';
  }
  return 'info';
}

// tsup builds each db entry point without code splitting, so a consumer can
// hold several copies of this module. Keep the level on a shared global so
// `window.skuilder.logLevel(...)` reaches all of them.
const shared: { level: LogLevel } = ((globalThis as any).__skuilderDbLog ??= {
  level: initialLevel(),
});

export function getLogLevel(): LogLevel {
  return shared.level;
}

/**
 * Set the active log level. In the browser this persists across reloads
 * unless `persist` is false.
 */
export function setLogLevel(level: LogLevel, persist = true): void {
  if (!isLevel(level)) {
    // eslint-disable-next-line no-console
    console.warn(`[DB] Unknown log level '${level}'. Use one of: ${Object.keys(LEVELS).join(', ')}`);
    return;
  }
  shared.level = level;
  if (isBrowser && persist) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, level);
    } catch {
      // storage blocked - level still applies for this page load
    }
  }
}

export const logger = {
  /**
   * Debug-level logging
   */
  debug: (message: string, ...args: any[]): void => {
    if (LEVELS[shared.level] <= LEVELS.debug) {
      // eslint-disable-next-line no-console
      console.debug(`[DB:DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info-level logging - general information
   */
  info: (message: string, ...args: any[]): void => {
    if (LEVELS[shared.level] <= LEVELS.info) {
      // eslint-disable-next-line no-console
      console.info(`[DB:INFO] ${message}`, ...args);
    }
  },

  /**
   * Warning-level logging - potential issues
   */
  warn: (message: string, ...args: any[]): void => {
    if (LEVELS[shared.level] <= LEVELS.warn) {
      // eslint-disable-next-line no-console
      console.warn(`[DB:WARN] ${message}`, ...args);
    }
  },

  /**
   * Error-level logging - serious problems
   */
  error: (message: string, ...args: any[]): void => {
    if (LEVELS[shared.level] <= LEVELS.error) {
      // eslint-disable-next-line no-console
      console.error(`[DB:ERROR] ${message}`, ...args);
    }
  },

  /**
   * Log function for backward compatibility with existing log() usage.
   * Debug level.
   */
  log: (message: string, ...args: any[]): void => {
    if (LEVELS[shared.level] <= LEVELS.debug) {
      // eslint-disable-next-line no-console
      console.log(`[DB:LOG] ${message}`, ...args);
    }
  },

  /**
   * Ungated output for interactive console tools (`window.skuilder.*`). The
   * user asked for it, so it prints regardless of level.
   */
  print: (message: string, ...args: any[]): void => {
    // eslint-disable-next-line no-console
    console.log(message, ...args);
  },
};

/**
 * Mount the level control on window.skuilder.logLevel
 *
 *   window.skuilder.logLevel()          // current level
 *   window.skuilder.logLevel('info')    // set + persist
 */
export function mountLogLevelControl(): void {
  if (!isBrowser) return;

  const win = window as any;
  win.skuilder = win.skuilder || {};
  win.skuilder.logLevel = (level?: LogLevel): LogLevel => {
    if (level !== undefined) setLogLevel(level);
    return getLogLevel();
  };
}

mountLogLevelControl();
