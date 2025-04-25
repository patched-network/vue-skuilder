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

// Determine if we're in browser or Node environment
const isBrowser = typeof window !== 'undefined';

// Function to get environment from Node process.env
function getNodeEnv(): Environment {
  console.log(`Process.env: ${JSON.stringify(process.env)}`);
  return {
    COUCHDB_SERVER_URL: process.env.COUCHDB_SERVER || defaultEnv.COUCHDB_SERVER_URL,
    COUCHDB_SERVER_PROTOCOL: (process.env.COUCHDB_PROTOCOL ||
      defaultEnv.COUCHDB_SERVER_PROTOCOL) as ProtocolString,
    EXPRESS_SERVER_URL: process.env.EXPRESS_SERVER || defaultEnv.EXPRESS_SERVER_URL,
    EXPRESS_SERVER_PROTOCOL: (process.env.EXPRESS_PROTOCOL ||
      defaultEnv.EXPRESS_SERVER_PROTOCOL) as ProtocolString,
    DEBUG: process.env.DEBUG === 'true' || defaultEnv.DEBUG,
    MOCK: process.env.MOCK === 'true' || defaultEnv.MOCK,
  };
}

// Get environment based on runtime context
let ENV: Environment;

if (isBrowser) {
  // Browser environment - use window.__SKUILDER_ENV__ if available
  ENV = window.__SKUILDER_ENV__ ? { ...defaultEnv, ...window.__SKUILDER_ENV__ } : defaultEnv;
  console.log('Browser ENV initialized:', ENV);
} else {
  // Node.js environment - use process.env
  ENV = getNodeEnv();
  console.log('Node ENV initialized:', ENV);
}

export default ENV;
