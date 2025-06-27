#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { initializeDataDirectory, initializeTuiLogging } from '@vue-skuilder/db';

// Initialize TUI logging first (redirects console to log file)
initializeTuiLogging();

// Initialize PouchDB data directory before starting app
await initializeDataDirectory();

// This is a placeholder for the main app rendering
import './App.js';

yargs(hideBin(process.argv))
  .command('study', 'Start a study session', () => {},
    (_argv) => {
      // The App.tsx will be rendered by the import above
    }
  )
  .demandCommand(1)
  .parse();
