/**
 * Vue-Skuilder Express API
 * 
 * Provides programmatic access to the Express server for CLI studio mode
 * while preserving the primary standalone server functionality.
 */

// Main factory functions for programmatic usage
export { createExpressApp, initializeServices } from './app-factory.js';

// Type definitions for configuration and results
export type { 
  ExpressServerConfig, 
  ServerStartResult
} from './types.js';

export type { 
  AppConfig,
  VueClientRequest
} from './app-factory.js';

// Re-export environment type for convenience
export type { Env as EnvironmentConfig } from './utils/env.js';