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

const env: Env = {
  COUCHDB_SERVER: getVar('COUCHDB_SERVER'),
  COUCHDB_PROTOCOL: getVar('COUCHDB_PROTOCOL'),
  COUCHDB_ADMIN: getVar('COUCHDB_ADMIN'),
  COUCHDB_PASSWORD: getVar('COUCHDB_PASSWORD'),
  VERSION: getVar('VERSION'),
  NODE_ENV: getVar('NODE_ENV'),
};

export default env;
