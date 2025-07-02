// TUI-aware logging utility that redirects logs to file in Node.js
import * as fs from 'fs';
import * as path from 'path';
import { getAppDataDirectory } from './dataDirectory';

let logFile: string | null = null;
let isNodeEnvironment = false;

/**
 * Initialize TUI logging - redirect console logs to file in Node.js
 */
export function initializeTuiLogging(): void {
  // Detect Node.js environment
  isNodeEnvironment = typeof window === 'undefined' && typeof process !== 'undefined';
  
  if (!isNodeEnvironment) {
    return; // Browser environment - keep normal console logging
  }

  try {
    // Set up log file path
    logFile = path.join(getAppDataDirectory(), 'lastrun.log');
    
    // Clear previous log file
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
    
    // Create initial log entry
    const startTime = new Date().toISOString();
    fs.writeFileSync(logFile, `=== TUI Session Started: ${startTime} ===\n`);
    
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
    
    const writeToLog = (level: string, args: any[]) => {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      const logEntry = `[${timestamp}] ${level}: ${message}\n`;
      
      try {
        fs.appendFileSync(logFile!, logEntry);
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
    
    // Store original methods for potential restoration
    (console as any)._originalMethods = originalConsole;
    
    // eslint-disable-next-line no-console
    console.log('TUI logging initialized - logs redirected to', logFile);
    
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize TUI logging:', err);
  }
}

/**
 * Get the current log file path (for debugging)
 */
export function getLogFilePath(): string | null {
  return logFile;
}

/**
 * Show user-facing message (always visible in TUI)
 */
export function showUserMessage(message: string): void {
  if (isNodeEnvironment) {
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
 */
export function showUserError(message: string): void {
  if (isNodeEnvironment) {
    // In Node.js, write directly to stderr to bypass log redirection
    process.stderr.write('Error: ' + message + '\n');
  } else {
    // In browser, use normal console
    // eslint-disable-next-line no-console
    console.error(message);
  }
}