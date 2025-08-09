// vue-skuilder/packages/standalone-ui/src/ENVIRONMENT_VARS.ts
type ProtocolString = 'http' | 'https';

import config from '../skuilder.config.json';

export interface Environment {
  /**
   * URL to the remote couchDB instance that the app connects to.
   * Loaded from VITE_COUCHDB_SERVER_URL environment variable.
   */
  COUCHDB_SERVER_URL: string;

  /**
   * Protocol for the CouchDB server.
   * Loaded from VITE_COUCHDB_SERVER_PROTOCOL environment variable.
   */
  COUCHDB_SERVER_PROTOCOL: ProtocolString;

  /**
   * Static course IDs to load.
   * Loaded from VITE_STATIC_COURSE_IDS environment variable (comma-separated string).
   */
  STATIC_COURSE_ID: string;

  /**
   * Type of data layer to use - couchdb live backend or
   * statically built and served from the app.
   */
  DATALAYER_TYPE: 'couch' | 'static';

  /**
   * A global flag to enable debug messaging mode.
   * Loaded from VITE_DEBUG environment variable ('true' or 'false').
   */
  DEBUG: boolean;
}

// Default fallback values if environment variables are not set
const defaultEnv: Environment = {
  COUCHDB_SERVER_URL: 'localhost:5984/', // Sensible default for local dev
  COUCHDB_SERVER_PROTOCOL: 'http',
  STATIC_COURSE_ID: 'not_set',
  DATALAYER_TYPE: 'couch',
  DEBUG: false, // Default to false if VITE_DEBUG is not 'true'
};

// --- Read Environment Variables using Vite's import.meta.env ---
// Vite replaces these variables at build time with the values from your .env files.

if (config.dataLayerType !== 'couch' && config.dataLayerType !== 'static') {
  throw new Error('Invalid data layer type');
}

const ENV: Environment = {
  // Use the value from import.meta.env if available, otherwise use the default
  COUCHDB_SERVER_URL: import.meta.env.VITE_COUCHDB_SERVER || defaultEnv.COUCHDB_SERVER_URL,

  // Ensure the protocol is one of the allowed types
  COUCHDB_SERVER_PROTOCOL: (import.meta.env.VITE_COUCHDB_PROTOCOL === 'https'
    ? 'https'
    : 'http') as ProtocolString,

  STATIC_COURSE_ID: config.course,

  DATALAYER_TYPE: config.dataLayerType,

  // Environment variables are always strings, so compare VITE_DEBUG to 'true'
  DEBUG: import.meta.env.VITE_DEBUG === 'true',
};

// Optional: Log the resolved environment in development mode for debugging
if (import.meta.env.DEV) {
  console.log('Resolved Environment Variables:', ENV);
}

export default ENV;
