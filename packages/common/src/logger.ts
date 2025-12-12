/**
 * Standard logger interface for vue-skuilder packages
 *
 * This interface enables dependency injection of logging functionality,
 * allowing different runtime contexts to provide appropriate logger implementations:
 * - Node.js contexts can use Winston
 * - Browser contexts can use console wrappers
 * - Test contexts can use mock loggers
 */
export interface SkLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * No-op logger implementation for contexts where logging is not needed
 */
export const noOpLogger: SkLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Console-based logger for browser/development contexts
 * Uses console methods with appropriate ESLint suppressions
 */
export const consoleLogger: SkLogger = {
  debug: (message: string, ...args: unknown[]) => console.debug(message, ...args), // eslint-disable-line no-console
  info: (message: string, ...args: unknown[]) => console.info(message, ...args), // eslint-disable-line no-console
  warn: (message: string, ...args: unknown[]) => console.warn(message, ...args), // eslint-disable-line no-console
  error: (message: string, ...args: unknown[]) => console.error(message, ...args), // eslint-disable-line no-console
};

/**
 * File-based logger for Node.js debugging contexts
 * Appends logs to a file with timestamps
 */
export function createFileLogger(filePath: string): SkLogger {
  // Lazy import fs to avoid bundling issues

  type FsModule = typeof import('fs');
  let fs: FsModule | null = null;

  const writeLog = (level: string, message: string, ...args: unknown[]) => {
    if (!fs) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        fs = require('fs') as FsModule;
      } catch {
        // File logging not available in this context
        return;
      }
    }

    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ' ' + JSON.stringify(args) : '';
    const logLine = `[${timestamp}] [${level}] ${message}${argsStr}\n`;

    try {
      fs.appendFileSync(filePath, logLine, 'utf8');
    } catch {
      // Silently fail if we can't write to the file
    }
  };

  return {
    debug: (message: string, ...args: unknown[]) => writeLog('DEBUG', message, ...args),
    info: (message: string, ...args: unknown[]) => writeLog('INFO', message, ...args),
    warn: (message: string, ...args: unknown[]) => writeLog('WARN', message, ...args),
    error: (message: string, ...args: unknown[]) => writeLog('ERROR', message, ...args),
  };
}

// ============================================================================
// TUI-aware logging utilities - redirects console output to file in Node.js
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// TUI-aware logging state
let tuiLogFile: string | null = null;
let tuiIsNodeEnvironment = false;

/**
 * Get the application data directory for TUI logging
 * Uses ~/.tuilder for cross-platform compatibility
 */
function getTuiLogDirectory(): string {
  return path.join(os.homedir(), '.tuilder');
}

/**
 * Initialize TUI logging - redirect console logs to file in Node.js
 *
 * This function should be called once at the entry point of CLI applications
 * to redirect all console output to a log file, preventing interference with
 * interactive prompts (inquirer, etc).
 *
 * @example
 * import { initializeTuiLogging } from '@vue-skuilder/common';
 * initializeTuiLogging();
 */
export function initializeTuiLogging(): void {
  // Detect Node.js environment
  tuiIsNodeEnvironment = typeof window === 'undefined' && typeof process !== 'undefined';

  if (!tuiIsNodeEnvironment) {
    return; // Browser environment - keep normal console logging
  }

  try {
    // Set up log file path
    const logDir = getTuiLogDirectory();

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    tuiLogFile = path.join(logDir, 'lastrun.log');

    // Clear previous log file
    if (fs.existsSync(tuiLogFile)) {
      fs.unlinkSync(tuiLogFile);
    }

    // Create initial log entry
    const startTime = new Date().toISOString();
    fs.writeFileSync(tuiLogFile, `=== TUI Session Started: ${startTime} ===\n`);

    // Redirect console methods to file
    const originalConsole = {
      // eslint-disable-next-line no-console
      log: console.log,
      // eslint-disable-next-line no-console
      error: console.error,
      // eslint-disable-next-line no-console
      warn: console.warn,
      // eslint-disable-next-line no-console
      info: console.info
    };

    const writeToLog = (level: string, args: unknown[]) => {
      const timestamp = new Date().toISOString();
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      const logEntry = `[${timestamp}] ${level}: ${message}\n`;

      try {
        fs.appendFileSync(tuiLogFile!, logEntry);
      } catch (err) {
        // Fallback to original console if file write fails
        originalConsole.error('Failed to write to log file:', err);
        originalConsole[level.toLowerCase() as keyof typeof originalConsole](...args);
      }
    };

    // Override console methods
    // eslint-disable-next-line no-console
    console.log = (...args) => writeToLog('INFO', args);
    // eslint-disable-next-line no-console
    console.info = (...args) => writeToLog('INFO', args);
    // eslint-disable-next-line no-console
    console.warn = (...args) => writeToLog('WARN', args);
    // eslint-disable-next-line no-console
    console.error = (...args) => writeToLog('ERROR', args);

    // eslint-disable-next-line no-console
    console.log('TUI logging initialized - logs redirected to', tuiLogFile);

  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize TUI logging:', err);
  }
}

/**
 * Get the current log file path (for debugging)
 * @returns Path to current log file, or null if not initialized
 */
export function getLogFilePath(): string | null {
  return tuiLogFile;
}

/**
 * Show user-facing message (always visible in TUI)
 *
 * This bypasses log redirection to ensure the message appears in the terminal.
 * Use this for important user-facing messages in CLI applications.
 *
 * @param message - Message to display to user
 */
export function showUserMessage(message: string): void {
  if (tuiIsNodeEnvironment) {
    // In Node.js, write directly to stdout to bypass log redirection
    process.stdout.write(message + '\n');
  } else {
    // In browser, use normal console
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

/**
 * Show user-facing error (always visible in TUI)
 *
 * This bypasses log redirection to ensure the error appears in the terminal.
 * Use this for critical errors that users must see in CLI applications.
 *
 * @param message - Error message to display to user
 */
export function showUserError(message: string): void {
  if (tuiIsNodeEnvironment) {
    // In Node.js, write directly to stderr to bypass log redirection
    process.stderr.write('Error: ' + message + '\n');
  } else {
    // In browser, use normal console
    // eslint-disable-next-line no-console
    console.error(message);
  }
}

/**
 * TUI-aware logger instance
 *
 * This logger object respects TUI logging initialization. When initializeTuiLogging()
 * has been called, log output is redirected to file. Otherwise, it outputs to console.
 *
 * @example
 * import { initializeTuiLogging, tuiLogger } from '@vue-skuilder/common';
 * initializeTuiLogging();
 * tuiLogger.info('Application started');
 */
export const tuiLogger = {
  debug: (message: string, ...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] ${message}`, ...args);
  },
  info: (message: string, ...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.info(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${message}`, ...args);
  },
};
