import { existsSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { CliOptions } from '../types.js';
import { gatherProjectConfig, confirmProjectCreation, displayThemePreview } from '../utils/prompts.js';
import { processTemplate } from '../utils/template.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function initCommand(
  projectName: string,
  options: CliOptions
): Promise<void> {
  try {
    // Validate project name
    if (!isValidProjectName(projectName)) {
      console.error(chalk.red('❌ Invalid project name. Use only letters, numbers, hyphens, and underscores.'));
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

    // Gather project configuration
    const config = await gatherProjectConfig(projectName, options);

    // Confirm project creation (only in interactive mode)
    if (options.interactive) {
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
      console.log(chalk.yellow('📝 Note: Make sure your CouchDB server is running and accessible.'));
      if (config.course) {
        console.log(chalk.yellow(`📚 Course ID "${config.course}" will be loaded from the database.`));
      }
    } else {
      console.log(chalk.yellow('📝 Note: This project uses static data. Sample course data has been included.'));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Failed to create project:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

function isValidProjectName(name: string): boolean {
  // Allow letters, numbers, hyphens, and underscores
  // Must start with a letter or number
  const validNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/;
  return validNameRegex.test(name) && name.length > 0 && name.length <= 214;
}