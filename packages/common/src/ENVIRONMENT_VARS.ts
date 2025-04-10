// packages/common/src/ENVIRONMENT_VARS.ts
export interface Environment {
  /**
   * URL to the remote couchDB instance that the app connects to.
   *
   * In development, this can be set as a simple string so that an in-browser
   * pouch-db instance is used instead.
   */
  COUCHDB_SERVER_URL: string;
  COUCHDB_SERVER_PROTOCOL: ProtocolString;
  /**
   * URL to the Express webserver that serves requests for
   * database creation / reading / writing that are finer-
   * grained than CouchDB's auth system handles automatically
   */
  EXPRESS_SERVER_URL: string;
  EXPRESS_SERVER_PROTOCOL: ProtocolString;

  /**
   * A global flag to enable debug messaging mode for different libraries
   * in the project.
   */
  DEBUG: boolean;

  /**
   * A flag to enable the use of mock data instead of real data.
   */
  MOCK: boolean;
}

type ProtocolString = 'http' | 'https';

declare global {
  interface Window {
    __SKUILDER_ENV__: Environment | undefined;
  }
}

// Default fallback values if all else fails
const defaultEnv: Environment = {
  COUCHDB_SERVER_URL: 'localhost:5984/',
  COUCHDB_SERVER_PROTOCOL: 'http',
  EXPRESS_SERVER_URL: 'localhost:3000/',
  EXPRESS_SERVER_PROTOCOL: 'http',
  DEBUG: false,
  MOCK: false,
};

// Get environment from global or default
const ENV: Environment =
  typeof window !== 'undefined' && window.__SKUILDER_ENV__
    ? { ...defaultEnv, ...window.__SKUILDER_ENV__ }
    : defaultEnv;

// Log the initialized environment
console.log('ENV initialized:', ENV);

export default ENV;
