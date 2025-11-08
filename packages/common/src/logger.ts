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
