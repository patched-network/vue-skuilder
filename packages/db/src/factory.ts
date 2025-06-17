// db/src/factory.ts

import { DataLayerProvider } from './core/interfaces';
import { logger } from './util/logger';
import { StaticCourseManifest } from './util/packer/types';

interface DBEnv {
  COUCHDB_SERVER_URL: string; // URL of CouchDB server
  COUCHDB_SERVER_PROTOCOL: string; // Protocol of CouchDB server (http or https)
  COUCHDB_USERNAME?: string;
  COUCHDB_PASSWORD?: string;
}

export const ENV: DBEnv = {
  COUCHDB_SERVER_PROTOCOL: 'NOT_SET',
  COUCHDB_SERVER_URL: 'NOT_SET',
};

// Configuration type for data layer initialization
export interface DataLayerConfig {
  type: 'couch' | 'static';
  options: {
    staticContentPath?: string; // Path to static content JSON files
    localStoragePrefix?: string; // Prefix for IndexedDB storage names
    manifests?: Record<string, StaticCourseManifest>; // Course manifests for static mode
    COUCHDB_SERVER_URL?: string;
    COUCHDB_SERVER_PROTOCOL?: string;
    COUCHDB_USERNAME?: string;
    COUCHDB_PASSWORD?: string;

    COURSE_IDS?: string[];
  };
}

// Singleton instance
let dataLayerInstance: DataLayerProvider | null = null;

/**
 * Initialize the data layer with the specified configuration
 */
export async function initializeDataLayer(config: DataLayerConfig): Promise<DataLayerProvider> {
  if (dataLayerInstance) {
    logger.warn('Data layer already initialized. Returning existing instance.');
    return dataLayerInstance;
  }

  if (config.type === 'couch') {
    if (!config.options.COUCHDB_SERVER_URL || !config.options.COUCHDB_SERVER_PROTOCOL) {
      throw new Error('Missing CouchDB server URL or protocol');
    }
    ENV.COUCHDB_SERVER_PROTOCOL = config.options.COUCHDB_SERVER_PROTOCOL;
    ENV.COUCHDB_SERVER_URL = config.options.COUCHDB_SERVER_URL;
    ENV.COUCHDB_USERNAME = config.options.COUCHDB_USERNAME;
    ENV.COUCHDB_PASSWORD = config.options.COUCHDB_PASSWORD;

    // Dynamic import to avoid loading both implementations when only one is needed
    const { CouchDataLayerProvider } = await import('./impl/couch/PouchDataLayerProvider');
    dataLayerInstance = new CouchDataLayerProvider(config.options.COURSE_IDS);
  } else if (config.type === 'static') {
    const { StaticDataLayerProvider } = await import('./impl/static/StaticDataLayerProvider');
    dataLayerInstance = new StaticDataLayerProvider(config.options);
  } else {
    throw new Error(`Unknown data layer type: ${config.type}`);
  }

  await dataLayerInstance.initialize();
  return dataLayerInstance;
}

/**
 * Get the initialized data layer instance
 * @throws Error if not initialized
 */
export function getDataLayer(): DataLayerProvider {
  if (!dataLayerInstance) {
    throw new Error('Data layer not initialized. Call initializeDataLayer first.');
  }
  return dataLayerInstance;
}

/**
 * Reset the data layer (primarily for testing)
 */
export async function _resetDataLayer(): Promise<void> {
  if (dataLayerInstance) {
    await dataLayerInstance.teardown();
  }
  dataLayerInstance = null;
}
