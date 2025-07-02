// Cross-platform data directory utilities for PouchDB
// Provides OS-appropriate application data directories

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './tuiLogger';

/**
 * Get the application data directory for the current platform
 * Uses ~/.tuilder as requested by user for simplicity
 */
export function getAppDataDirectory(): string {
  return path.join(os.homedir(), '.tuilder');
}

/**
 * Ensure the application data directory exists
 * Creates directory recursively if it doesn't exist
 */
export async function ensureAppDataDirectory(): Promise<string> {
  const appDataDir = getAppDataDirectory();
  
  try {
    await fs.promises.mkdir(appDataDir, { recursive: true });
  } catch (err: any) {
    if (err.code !== 'EEXIST') {
      throw new Error(`Failed to create app data directory ${appDataDir}: ${err.message}`);
    }
  }
  
  return appDataDir;
}

/**
 * Get the full path for a PouchDB database file
 * @param dbName - The database name (e.g., 'userdb-Colin')
 */
export function getDbPath(dbName: string): string {
  return path.join(getAppDataDirectory(), dbName);
}

/**
 * Initialize data directory for PouchDB usage
 * Should be called once at application startup
 */
export async function initializeDataDirectory(): Promise<void> {
  await ensureAppDataDirectory();
  
  // Log initialization
  logger.info(`PouchDB data directory initialized: ${getAppDataDirectory()}`);
}