// db/src/factory.ts

import { DataLayerProvider } from './core/interfaces';

interface DBEnv {
  COUCHDB_SERVER_URL: string; // URL of CouchDB server
  COUCHDB_SERVER_PROTOCOL: string; // Protocol of CouchDB server (http or https)
}

export const ENV: DBEnv = {
  COUCHDB_SERVER_PROTOCOL: 'NOT_SET',
  COUCHDB_SERVER_URL: 'NOT_SET',
};

// Configuration type for data layer initialization
export interface DataLayerConfig {
  type: 'pouch' | 'static';
  options: {
    staticContentPath?: string; // Path to static content JSON files
    localStoragePrefix?: string; // Prefix for IndexedDB storage names
    COUCHDB_SERVER_URL?: string;
    COUCHDB_SERVER_PROTOCOL?: string;
  };
}

// Singleton instance
let dataLayerInstance: DataLayerProvider | null = null;

/**
 * Initialize the data layer with the specified configuration
 */
export async function initializeDataLayer(config: DataLayerConfig): Promise<DataLayerProvider> {
  if (dataLayerInstance) {
    console.warn('Data layer already initialized. Returning existing instance.');
    return dataLayerInstance;
  }

  if (config.type === 'pouch') {
    if (!config.options.COUCHDB_SERVER_URL || !config.options.COUCHDB_SERVER_PROTOCOL) {
      throw new Error('Missing CouchDB server URL or protocol');
    }
    ENV.COUCHDB_SERVER_PROTOCOL = config.options.COUCHDB_SERVER_PROTOCOL;
    ENV.COUCHDB_SERVER_URL = config.options.COUCHDB_SERVER_URL;

    // Dynamic import to avoid loading both implementations when only one is needed
    const { PouchDataLayerProvider } = await import('./impl/pouch/PouchDataLayerProvider');
    dataLayerInstance = new PouchDataLayerProvider();
  } else {
    throw new Error('static data layer not implemented');
    // const { StaticDataLayerProvider } = await import('./impl/static/StaticDataLayerProvider');
    // dataLayerInstance = new StaticDataLayerProvider(config.options);
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
