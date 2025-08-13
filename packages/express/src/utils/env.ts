import process from 'process';

export type Env = {
  COUCHDB_SERVER: string;
  COUCHDB_PROTOCOL: string;
  COUCHDB_ADMIN: string;
  COUCHDB_PASSWORD: string;
  VERSION: string;
  NODE_ENV: string;
  COURSE_IDS?: string[];
};

function getVar(name: string): string {
  if (process.env[name]) {
    return process.env[name];
  } else {
    // For standalone mode, we'll validate these elsewhere.
    // For programmatic mode, they are provided via config.
    return '';
  }
}

// Use getter to read environment variables lazily after dotenv has loaded
const env: Env = {
  get COUCHDB_SERVER() { return getVar('COUCHDB_SERVER'); },
  get COUCHDB_PROTOCOL() { return getVar('COUCHDB_PROTOCOL'); },
  get COUCHDB_ADMIN() { return getVar('COUCHDB_ADMIN'); },
  get COUCHDB_PASSWORD() { return getVar('COUCHDB_PASSWORD'); },
  get VERSION() { return getVar('VERSION'); },
  get NODE_ENV() { return getVar('NODE_ENV'); },
};

export default env;
