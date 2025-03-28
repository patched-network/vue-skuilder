interface Environment {
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

// Create a global reference to ensure singleton behavior
declare global {
  interface Window {
    __SKUILDER_ENV__: Environment | undefined;
  }
}
let ENV: Environment = {
  COUCHDB_SERVER_URL: '',
  COUCHDB_SERVER_PROTOCOL: 'http',
  EXPRESS_SERVER_URL: '',
  EXPRESS_SERVER_PROTOCOL: 'http',
  DEBUG: false,
  MOCK: false,
};

if (typeof window !== 'undefined' && window.__SKUILDER_ENV__) {
  console.log('Using existing ENV from global scope');
  ENV = window.__SKUILDER_ENV__;
} else {
  // Try to load from Vite environment if available
  try {
    // Use typeof check to avoid issues in non-Vite environments
    if (typeof import.meta !== 'undefined' && 'env' in import.meta) {
      const env = (import.meta as any).env;

      if (env.VITE_COUCHDB_SERVER) {
        ENV.COUCHDB_SERVER_URL = env.VITE_COUCHDB_SERVER;
      }

      if (env.VITE_COUCHDB_PROTOCOL) {
        ENV.COUCHDB_SERVER_PROTOCOL = env.VITE_COUCHDB_PROTOCOL as ProtocolString;
      }

      if (env.VITE_EXPRESS_SERVER) {
        ENV.EXPRESS_SERVER_URL = env.VITE_EXPRESS_SERVER;
      }

      if (env.VITE_EXPRESS_PROTOCOL) {
        ENV.EXPRESS_SERVER_PROTOCOL = env.VITE_EXPRESS_PROTOCOL as ProtocolString;
      }

      if (env.VITE_DEBUG !== undefined) {
        ENV.DEBUG = env.VITE_DEBUG === 'true';
      }

      if (env.VITE_MOCK !== undefined) {
        ENV.MOCK = env.VITE_MOCK === 'true';
      }
    }
  } catch (e) {
    console.warn('Unable to load environment variables from Vite:', e);
  }
  // Store in global scope if in browser environment
  if (typeof window !== 'undefined' && ENV.COUCHDB_SERVER_URL && ENV.EXPRESS_SERVER_URL) {
    window.__SKUILDER_ENV__ = ENV;
    console.log('ENV initialized and stored in global scope');

    console.log(`ENV init:`);

    console.log(`  COUCHDB_SERVER_URL: ${ENV.COUCHDB_SERVER_URL}`);
    console.log(`  COUCHDB_SERVER_PROTOCOL: ${ENV.COUCHDB_SERVER_PROTOCOL}`);
    console.log(`  EXPRESS_SERVER_URL: ${ENV.EXPRESS_SERVER_URL}`);
    console.log(`  EXPRESS_SERVER_PROTOCOL: ${ENV.EXPRESS_SERVER_PROTOCOL}`);
    console.log(`  DEBUG: ${ENV.DEBUG}`);
    console.log(`  MOCK: ${ENV.MOCK}`);
  } else {
    console.warn('ENV initialization failed');
  }
}

// if (ENV.DEBUG) {
// }

export default ENV;
