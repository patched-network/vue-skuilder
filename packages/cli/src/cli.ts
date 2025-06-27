#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createInitCommand } from './commands/init.js';
import { createPackCommand } from './commands/pack.js';
import { createUnpackCommand } from './commands/unpack.js';
import { createStudioCommand } from './commands/studio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get version
const packagePath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

const program = new Command();

program
  .name('skuilder')
  .description('CLI tool for scaffolding Skuilder course applications')
  .version(packageJson.version);

// Add commands
program.addCommand(createInitCommand());
program.addCommand(createPackCommand());
program.addCommand(createUnpackCommand());
program.addCommand(createStudioCommand());

program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ skuilder init my-anatomy-course');
  console.log('  $ skuilder init biology-101 --data-layer=static --theme=medical');
  console.log('  $ skuilder init physics --no-interactive --data-layer=dynamic');
  console.log('  $ skuilder pack sample-course-id');
  console.log('  $ skuilder pack biology-101 --server http://localhost:5984 --username admin');
  console.log('  $ skuilder unpack ./static-courses/biology-101');
  console.log('  $ skuilder unpack ./my-course --database test-migration --validate');
  console.log('  $ skuilder studio ./my-sui-course');
  console.log('  $ skuilder studio . --port 5985 --no-browser');
});

program.parse();
