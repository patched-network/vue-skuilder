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

// Default fallback values if all else fails
const defaultEnv: Environment = {
  COUCHDB_SERVER_URL: 'localhost:5984/',
  COUCHDB_SERVER_PROTOCOL: 'http',
  EXPRESS_SERVER_URL: 'localhost:3000/',
  EXPRESS_SERVER_PROTOCOL: 'http',
  DEBUG: false,
  MOCK: false,
};

// Function to load environment variables from Vite
function loadFromVite(): Partial<Environment> {
  const result: Partial<Environment> = {};

  try {
    // Use typeof check to avoid issues in non-Vite environments
    if (typeof import.meta !== 'undefined' && 'env' in import.meta) {
      const env = (import.meta as any).env;

      if (env.VITE_COUCHDB_SERVER) {
        result.COUCHDB_SERVER_URL = env.VITE_COUCHDB_SERVER;
      }

      if (env.VITE_COUCHDB_PROTOCOL) {
        result.COUCHDB_SERVER_PROTOCOL = env.VITE_COUCHDB_PROTOCOL as ProtocolString;
      }

      if (env.VITE_EXPRESS_SERVER) {
        result.EXPRESS_SERVER_URL = env.VITE_EXPRESS_SERVER;
      }

      if (env.VITE_EXPRESS_PROTOCOL) {
        result.EXPRESS_SERVER_PROTOCOL = env.VITE_EXPRESS_PROTOCOL as ProtocolString;
      }

      if (env.VITE_DEBUG !== undefined) {
        result.DEBUG = env.VITE_DEBUG === 'true';
      }

      if (env.VITE_MOCK !== undefined) {
        result.MOCK = env.VITE_MOCK === 'true';
      }
    }
  } catch (e) {
    console.warn('Unable to load environment variables from Vite:', e);
  }

  return result;
}

// Function to validate if environment is properly loaded
function isValidEnv(env: Environment): boolean {
  return Boolean(env.COUCHDB_SERVER_URL && env.EXPRESS_SERVER_URL);
}

// Initialize ENV with a blocking retry mechanism if needed
let ENV: Environment;

// First check if we have a global instance already
if (
  typeof window !== 'undefined' &&
  window.__SKUILDER_ENV__ &&
  isValidEnv(window.__SKUILDER_ENV__)
) {
  console.log('Using existing ENV from global scope');
  ENV = window.__SKUILDER_ENV__;
} else {
  // Try loading with a blocking retry if in browser environment
  if (typeof window !== 'undefined') {
    let viteEnv = loadFromVite();

    // If initial load didn't succeed, do a blocking retry
    if (!viteEnv.COUCHDB_SERVER_URL || !viteEnv.EXPRESS_SERVER_URL) {
      console.warn('Initial ENV load incomplete, performing blocking retries...');

      // Synchronous retries with exponential backoff
      const maxRetries = 5;
      let retryCount = 0;
      let baseDelay = 20; // ms

      while (
        retryCount < maxRetries &&
        (!viteEnv.COUCHDB_SERVER_URL || !viteEnv.EXPRESS_SERVER_URL)
      ) {
        // Create a delay using a synchronous approach
        const delay = baseDelay * Math.pow(2, retryCount);
        const startTime = Date.now();
        while (Date.now() - startTime < delay) {
          // Empty blocking loop
        }

        retryCount++;
        console.log(`Retry ${retryCount}/${maxRetries} for ENV initialization...`);
        viteEnv = loadFromVite();
      }

      if (!viteEnv.COUCHDB_SERVER_URL || !viteEnv.EXPRESS_SERVER_URL) {
        console.error('ENV initialization failed after retries, using defaults');
        // Use default values if all retries fail
        ENV = { ...defaultEnv };
      } else {
        console.log('ENV successfully initialized after retries');
        ENV = { ...defaultEnv, ...viteEnv };
      }
    } else {
      ENV = { ...defaultEnv, ...viteEnv };
    }

    // Store in global scope
    window.__SKUILDER_ENV__ = ENV;
    console.log('ENV initialized and stored in global scope');
  } else {
    // Node.js environment (SSR or build)
    const viteEnv = loadFromVite();
    ENV = { ...defaultEnv, ...viteEnv };
  }
}

// Log the initialized environment
console.log(`ENV init:`);
console.log(`  COUCHDB_SERVER_URL: ${ENV.COUCHDB_SERVER_URL}`);
console.log(`  COUCHDB_SERVER_PROTOCOL: ${ENV.COUCHDB_SERVER_PROTOCOL}`);
console.log(`  EXPRESS_SERVER_URL: ${ENV.EXPRESS_SERVER_URL}`);
console.log(`  EXPRESS_SERVER_PROTOCOL: ${ENV.EXPRESS_SERVER_PROTOCOL}`);
console.log(`  DEBUG: ${ENV.DEBUG}`);
console.log(`  MOCK: ${ENV.MOCK}`);

export default ENV;
