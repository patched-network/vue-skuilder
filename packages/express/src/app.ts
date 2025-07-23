import { createExpressApp, initializeServices } from './app-factory.js';
import logger from './logger.js';
import ENV from './utils/env.js';

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
  await initializeServices();
};

init().catch((e) => {
  logger.error(`Error initializing app: ${JSON.stringify(e)}`);
});
