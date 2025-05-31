/**
 * Simple logging utility for @vue-skuilder/db package
 *
 * This utility provides environment-aware logging with ESLint suppressions
 * to resolve console statement violations while maintaining logging functionality.
 */

const isDevelopment = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
const _isBrowser = typeof window !== 'undefined';

export const logger = {
  /**
   * Debug-level logging - only shown in development
   */
  debug: (message: string, ...args: any[]): void => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.debug(`[DB:DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info-level logging - general information
   */
  info: (message: string, ...args: any[]): void => {
    // eslint-disable-next-line no-console
    console.info(`[DB:INFO] ${message}`, ...args);
  },

  /**
   * Warning-level logging - potential issues
   */
  warn: (message: string, ...args: any[]): void => {
    // eslint-disable-next-line no-console
    console.warn(`[DB:WARN] ${message}`, ...args);
  },

  /**
   * Error-level logging - serious problems
   */
  error: (message: string, ...args: any[]): void => {
    // eslint-disable-next-line no-console
    console.error(`[DB:ERROR] ${message}`, ...args);
  },

  /**
   * Log function for backward compatibility with existing log() usage
   */
  log: (message: string, ...args: any[]): void => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.log(`[DB:LOG] ${message}`, ...args);
    }
  },
};
