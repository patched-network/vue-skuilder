#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initCommand } from './commands/init.js';
import { createPackCommand } from './commands/pack.js';

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

program
  .command('init')
  .argument('<project-name>', 'name of the project to create')
  .description('create a new Skuilder course application')
  .option('--data-layer <type>', 'data layer type (static|dynamic)', 'dynamic')
  .option('--theme <name>', 'theme name (default|medical|educational|corporate)', 'default')
  .option('--no-interactive', 'skip interactive prompts')
  .option('--couchdb-url <url>', 'CouchDB server URL (for dynamic data layer)')
  .option('--course-id <id>', 'course ID to import (for dynamic data layer)')
  .action(initCommand);

// Add pack command
program.addCommand(createPackCommand());

program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ skuilder init my-anatomy-course');
  console.log('  $ skuilder init biology-101 --data-layer=static --theme=medical');
  console.log('  $ skuilder init physics --no-interactive --data-layer=dynamic');
  console.log('  $ skuilder pack sample-course-id');
  console.log('  $ skuilder pack biology-101 --server http://localhost:5984 --username admin');
});

program.parse();
