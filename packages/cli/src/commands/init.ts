import chalk from 'chalk';
import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { CliOptions } from '../types.js';
import {
  confirmProjectCreation,
  displayThemePreview,
  gatherProjectConfig,
} from '../utils/prompts.js';
import { processTemplate } from '../utils/template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createInitCommand(): Command {
  return new Command('init')
    .argument('<project-name>', 'name of the project to create')
    .description('create a new Skuilder course application')
    .option('--data-layer <type>', 'data layer type (static|dynamic)', 'dynamic')
    .option('--theme <name>', 'theme name (default|medical|educational|corporate)', 'default')
    .option('--no-interactive', 'skip interactive prompts')
    .option('--couchdb-url <url>', 'CouchDB server URL (for dynamic data layer)')
    .option('--course-id <id>', 'course ID to import (for dynamic data layer)')
    .action(initCommand);
}

interface InitOptions {
  dataLayer: string;
  theme: string;
  interactive: boolean;
  couchdbUrl?: string;
  courseId?: string;
}

async function initCommand(projectName: string, options: InitOptions): Promise<void> {
  try {
    // Validate project name
    if (!isValidProjectName(projectName)) {
      console.error(
        chalk.red('❌ Invalid project name. Use only letters, numbers, hyphens, and underscores.')
      );
      process.exit(1);
    }

    // Check if directory already exists
    const projectPath = path.resolve(process.cwd(), projectName);
    if (existsSync(projectPath)) {
      console.error(chalk.red(`❌ Directory "${projectName}" already exists.`));
      process.exit(1);
    }

    // Get CLI version for dependency transformation
    const packagePath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    const cliVersion = packageJson.version;

    // Convert options to CliOptions format
    const cliOptions: CliOptions = {
      dataLayer: options.dataLayer as 'static' | 'dynamic',
      theme: options.theme as 'default' | 'medical' | 'educational' | 'corporate',
      interactive: options.interactive,
      couchdbUrl: options.couchdbUrl,
      courseId: options.courseId,
    };

    // Gather project configuration
    const config = await gatherProjectConfig(projectName, cliOptions);

    // Confirm project creation (only in interactive mode)
    if (cliOptions.interactive) {
      const confirmed = await confirmProjectCreation(config, projectPath);
      if (!confirmed) {
        console.log(chalk.yellow('Project creation cancelled.'));
        return;
      }
    }

    console.log(chalk.cyan(`\n🛠️  Creating project "${projectName}"...\n`));

    // Process template and create project
    await processTemplate(projectPath, config, cliVersion);

    // Success message
    console.log(chalk.green('\n🎉 Project created successfully!\n'));

    // Show theme preview
    displayThemePreview(config.theme.name);

    console.log(chalk.cyan('\nNext steps:'));
    console.log(`  ${chalk.white('cd')} ${projectName}`);
    console.log(`  ${chalk.white('npm install')}`);
    console.log(`  ${chalk.white('npm run dev')}`);
    console.log('');

    if (config.dataLayerType === 'couch') {
      console.log(
        chalk.yellow('📝 Note: Make sure your CouchDB server is running and accessible.')
      );
      if (config.course) {
        console.log(
          chalk.yellow(`📚 Course ID "${config.course}" will be loaded from the database.`)
        );
      }
    } else {
      console.log(
        chalk.yellow(
          '📝 Note: This project uses static data. Sample course data has been included.'
        )
      );
    }
  } catch (error: unknown) {
    console.error(chalk.red('\n❌ Failed to create project:'));
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String((error as { message: unknown }).message);
    }
    console.error(chalk.red(errorMessage));
    process.exit(1);
  }
}

function isValidProjectName(name: string): boolean {
  // Allow letters, numbers, hyphens, and underscores
  // Must start with a letter or number
  const validNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/;
  return validNameRegex.test(name) && name.length > 0 && name.length <= 214;
}
