// db/src/factory.ts

import { DataLayerProvider } from './core/interfaces';

// Configuration type for data layer initialization
export interface DataLayerConfig {
  type: 'pouch' | 'static';
  options?: {
    staticContentPath?: string; // Path to static content JSON files
    localStoragePrefix?: string; // Prefix for IndexedDB storage names
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

  // Dynamic import to avoid loading both implementations when only one is needed
  if (config.type === 'pouch') {
    const { PouchDataLayerProvider } = await import('./impl/pouch/PouchDataLayerProvider');
    dataLayerInstance = new PouchDataLayerProvider(config.options);
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
