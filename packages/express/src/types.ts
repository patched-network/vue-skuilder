/**
 * Configuration interface for programmatic Express server usage.
 * Supports CLI studio mode with runtime configuration instead of environment variables.
 */
export interface ExpressServerConfig {
  /**
   * Port for Express server. If not provided, will auto-assign available port.
   * @default undefined (auto-assign)
   */
  port?: number;

  /** CouchDB connection configuration */
  couchdb: {
    /** CouchDB protocol (http/https) */
    protocol: string;
    /** CouchDB server URL (hostname:port format, e.g., "localhost:5984") */
    server: string;
    /** CouchDB admin username */
    username: string;
    /** CouchDB admin password */
    password: string;
  };

  /**
   * Application version string for Express endpoints
   * @example "0.1.11-0"
   */
  version: string;

  /**
   * Optional list of courseIDs to follow for postprocessing. If empty, server
   * will use courseDB-lookup to find and process all courses.
   */
  courseIDs?: string[];

  /**
   * Node.js environment mode
   * @default "development"
   */
  nodeEnv?: string;

  /**
   * CORS configuration options
   * @default { credentials: true, origin: true }
   */
  cors?: {
    /** Allow credentials in CORS requests */
    credentials: boolean;
    /** Allowed origins (true = all, string/array = specific origins) */
    origin: boolean | string | string[];
  };
}

// Re-export the existing environment config type from utils/env.ts
export type { Env as EnvironmentConfig } from './utils/env.js';

/**
 * Server startup result returned by SkuilderExpressServer.start()
 */
export interface ServerStartResult {
  /** Assigned port number */
  port: number;
  /** Complete server URL */
  url: string;
}
