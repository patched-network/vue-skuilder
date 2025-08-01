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
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
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
  debug: (message: string, ...args: any[]) => console.debug(message, ...args), // eslint-disable-line no-console
  info: (message: string, ...args: any[]) => console.info(message, ...args),   // eslint-disable-line no-console
  warn: (message: string, ...args: any[]) => console.warn(message, ...args),   // eslint-disable-line no-console
  error: (message: string, ...args: any[]) => console.error(message, ...args), // eslint-disable-line no-console
};