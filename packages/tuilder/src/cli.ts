#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// This is a placeholder for the main app rendering
import './App.js';

yargs(hideBin(process.argv))
  .command('study', 'Start a study session', () => {},
    (_argv) => {
      console.log('Starting study session...');
      // The App.tsx will be rendered by the import above
    }
  )
  .demandCommand(1)
  .parse();
