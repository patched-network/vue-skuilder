import chalk from 'chalk';
import { Command } from 'commander';
import { existsSync, readFileSync, rmSync } from 'fs';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { CliOptions, PREDEFINED_THEMES } from '../types.js';
import {
  confirmProjectCreation,
  displayThemePreview,
  gatherProjectConfig,
} from '../utils/prompts.js';
import { processTemplate } from '../utils/template.js';
import { packCourses } from '../utils/pack-courses.js';

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
    .option('--import-course-data', 'import course data from CouchDB (for static data layer)')
    .option('--import-server-url <url>', 'CouchDB server URL for course import (for static data layer)')
    .option('--import-username <username>', 'username for course import server')
    .option('--import-password <password>', 'password for course import server')
    .option('--import-course-ids <ids>', 'comma-separated course IDs to import')
    .option('--dangerously-clobber', 'overwrite existing directory')
    .action(initCommand);
}

interface InitOptions {
  dataLayer: string;
  theme: string;
  interactive: boolean;
  couchdbUrl?: string;
  courseId?: string;
  importCourseData?: boolean;
  importServerUrl?: string;
  importUsername?: string;
  importPassword?: string;
  importCourseIds?: string;
  dangerouslyClobber?: boolean;
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

    // Validate that import-* options require --import-course-data flag
    const importOptions = [
      { flag: '--import-server-url', value: options.importServerUrl },
      { flag: '--import-username', value: options.importUsername },
      { flag: '--import-password', value: options.importPassword },
      { flag: '--import-course-ids', value: options.importCourseIds }
    ];

    const usedImportOptions = importOptions.filter(opt => opt.value !== undefined);
    
    if (usedImportOptions.length > 0 && !options.importCourseData) {
      console.error(
        chalk.red('❌ Import options require the --import-course-data flag.')
      );
      console.error(
        chalk.yellow(`Used options: ${usedImportOptions.map(opt => opt.flag).join(', ')}`)
      );
      console.error(
        chalk.yellow('Add --import-course-data to enable course data import.')
      );
      process.exit(1);
    }

    // Validate theme option
    const validThemes = Object.keys(PREDEFINED_THEMES);
    if (!validThemes.includes(options.theme)) {
      console.error(
        chalk.red(`❌ Invalid theme: "${options.theme}"`)
      );
      console.error(
        chalk.yellow(`Valid themes: ${validThemes.join(', ')}`)
      );
      process.exit(1);
    }

    // Check if directory already exists
    const projectPath = path.resolve(process.cwd(), projectName);
    if (existsSync(projectPath)) {
      if (options.dangerouslyClobber) {
        console.log(chalk.yellow(`--dangerously-clobber specified, removing existing directory: ${projectPath}`));
        rmSync(projectPath, { recursive: true, force: true });
      } else {
        console.error(chalk.red(`❌ Directory "${projectName}" already exists.`));
        process.exit(1);
      }
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
      importCourseData: options.importCourseData,
      importServerUrl: options.importServerUrl,
      importUsername: options.importUsername,
      importPassword: options.importPassword,
      importCourseIds: options.importCourseIds,
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

    // Import course data if requested for static data layer
    if (config.dataLayerType === 'static' && config.importCourseData && config.importCourseIds && config.importCourseIds.length > 0) {
      console.log(chalk.cyan('\n📦 Importing course data...\n'));
      
      try {
        await packCourses({
          server: config.importServerUrl!,
          username: config.importUsername,
          password: config.importPassword,
          courseIds: config.importCourseIds,
          targetProjectDir: projectPath
        });
        
        console.log(chalk.green('✅ Course data imported successfully!'));
      } catch (error: unknown) {
        console.error(chalk.red('\n❌ Failed to import course data:'));
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = String((error as { message: unknown }).message);
        }
        console.error(chalk.red(errorMessage));
        console.log(chalk.yellow('\n⚠️  Project created successfully, but without course data.'));
        console.log(chalk.yellow('You can import course data later using the pack command.'));
      }
    }

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
      if (config.importCourseIds && config.importCourseIds.length > 0) {
        console.log(
          chalk.yellow(
            `📚 Note: This project uses static data with ${config.importCourseIds.length} imported course(s).`
          )
        );
        console.log(
          chalk.yellow(
            `📂 Course data is available in the public/static-courses/ directory.`
          )
        );
      } else {
        console.log(
          chalk.yellow(
            '📝 Note: This project uses static data. No course data has been imported.'
          )
        );
      }
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
