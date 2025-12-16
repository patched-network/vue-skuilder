#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { initializeTuiLogging } from '@vue-skuilder/common';

// Initialize TUI logging first (redirects console to log file)
// MUST happen before importing @vue-skuilder/db to catch all logs
initializeTuiLogging();

// Import DB package dynamically after logging is initialized
const { initializeDataDirectory } = await import('@vue-skuilder/db');

// Initialize PouchDB data directory before starting app
await initializeDataDirectory();

// Parse args first to check if we should run
yargs(hideBin(process.argv))
  .command('study', 'Start a study session', () => {}, () => {})
  .command('$0', 'Start a study session (default)', () => {}, () => {})
  .help()
  .parseSync();

// Import and render the app (this starts the ink UI)
import('./App.js');
