import { createExpressApp, initializeServices } from './app-factory.js';
import logger from './logger.js';
import ENV from './utils/env.js';
import dotenv from 'dotenv';
import { initializeCouchDB } from './couchdb/index.js';
import { initializeDataLayer } from '@vue-skuilder/db';

dotenv.config({
  path:
    process.argv && process.argv.length == 3
      ? process.argv[2]
      : '.env.development',
});

// Now that dotenv is configured, we can validate the environment
const requiredVars = ['COUCHDB_SERVER', 'COUCHDB_PROTOCOL', 'COUCHDB_ADMIN', 'COUCHDB_PASSWORD', 'VERSION', 'NODE_ENV'];
const missingVars = requiredVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
    missingVars.forEach(v => logger.error(`${v} not defined in environment`));
    process.exit(1);
}

// Initialize CouchDB connection
initializeCouchDB(ENV);

initializeDataLayer({
  type: 'couch',
  options: {
    COUCHDB_PASSWORD: ENV.COUCHDB_PASSWORD,
    COUCHDB_USERNAME: ENV.COUCHDB_ADMIN,
    COUCHDB_SERVER_PROTOCOL: ENV.COUCHDB_PROTOCOL,
    COUCHDB_SERVER_URL: ENV.COUCHDB_SERVER,
  },
}).catch((e) => {
  logger.error('Error initializing data layer:', e);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

logger.info(`Express app running version: ${ENV.VERSION}`);

const port = 3000;
let listening = false;

// Use the factory with environment config
const app = createExpressApp(ENV);

app.listen(port, () => {
  listening = true;
  logger.info(`Express app listening on port ${port}!`);
});

// Initialize services after startup
const init = async (): Promise<void> => {
  while (!listening) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await initializeServices(ENV);
};

init().catch((e) => {
  logger.error(`Error initializing app: ${JSON.stringify(e)}`);
});
