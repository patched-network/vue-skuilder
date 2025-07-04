import dotenv from 'dotenv';
import process from 'process';

import { initializeDataLayer } from '@vue-skuilder/db';
import logger from '../logger.js';

dotenv.config({
  path:
    process.argv && process.argv.length == 3
      ? process.argv[2]
      : '.env.development',
});

type Env = {
  COUCHDB_SERVER: string;
  COUCHDB_PROTOCOL: string;
  COUCHDB_ADMIN: string;
  COUCHDB_PASSWORD: string;
  VERSION: string;
  NODE_ENV: string;
};

function getVar(name: string): string {
  if (process.env[name]) {
    return process.env[name];
  } else {
    throw new Error(`${name} not defined in environment`);
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

initializeDataLayer({
  type: 'couch',
  options: {
    COUCHDB_PASSWORD: env.COUCHDB_PASSWORD,
    COUCHDB_USERNAME: env.COUCHDB_ADMIN,
    COUCHDB_SERVER_PROTOCOL: env.COUCHDB_PROTOCOL,
    COUCHDB_SERVER_URL: env.COUCHDB_SERVER,
  },
}).catch((e) => {
  logger.error('Error initializing data layer:', e);
  process.exit(1);
});

export default env;
