import inquirer from 'inquirer';
import chalk from 'chalk';
import { CliOptions, ProjectConfig, PREDEFINED_THEMES } from '../types.js';

/**
 * Convert hex color to closest ANSI color code
 */
function hexToAnsi(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Convert to 256-color ANSI
  const ansiCode = 16 + (36 * Math.round(r / 255 * 5)) + (6 * Math.round(g / 255 * 5)) + Math.round(b / 255 * 5);
  return `\x1b[48;5;${ansiCode}m`;
}

/**
 * Create a color swatch for terminal display
 */
function createColorSwatch(hex: string, label: string): string {
  const colorCode = hexToAnsi(hex);
  const reset = '\x1b[0m';
  return `${colorCode}  ${reset} ${label}`;
}

/**
 * Create theme preview with color swatches
 */
function createThemePreview(themeName: string): string {
  const theme = PREDEFINED_THEMES[themeName];
  const lightColors = theme.light.colors;
  
  const primarySwatch = createColorSwatch(lightColors.primary, 'Primary');
  const secondarySwatch = createColorSwatch(lightColors.secondary, 'Secondary');
  const accentSwatch = createColorSwatch(lightColors.accent, 'Accent');
  
  return `${primarySwatch} ${secondarySwatch} ${accentSwatch}`;
}

/**
 * Display comprehensive theme preview after selection
 */
export function displayThemePreview(themeName: string): void {
  const theme = PREDEFINED_THEMES[themeName];
  
  console.log(chalk.cyan('\n🎨 Theme Color Palette:'));
  console.log(chalk.white(`   ${theme.name.toUpperCase()} THEME`));
  
  // Light theme colors
  console.log(chalk.white('\n   Light Mode:'));
  const lightColors = theme.light.colors;
  console.log(`     ${createColorSwatch(lightColors.primary, `Primary: ${lightColors.primary}`)}`);
  console.log(`     ${createColorSwatch(lightColors.secondary, `Secondary: ${lightColors.secondary}`)}`);
  console.log(`     ${createColorSwatch(lightColors.accent, `Accent: ${lightColors.accent}`)}`);
  console.log(`     ${createColorSwatch(lightColors.success, `Success: ${lightColors.success}`)}`);
  console.log(`     ${createColorSwatch(lightColors.warning, `Warning: ${lightColors.warning}`)}`);
  console.log(`     ${createColorSwatch(lightColors.error, `Error: ${lightColors.error}`)}`);
  
  // Dark theme colors
  console.log(chalk.white('\n   Dark Mode:'));
  const darkColors = theme.dark.colors;
  console.log(`     ${createColorSwatch(darkColors.primary, `Primary: ${darkColors.primary}`)}`);
  console.log(`     ${createColorSwatch(darkColors.secondary, `Secondary: ${darkColors.secondary}`)}`);
  console.log(`     ${createColorSwatch(darkColors.accent, `Accent: ${darkColors.accent}`)}`);
  console.log(`     ${createColorSwatch(darkColors.success, `Success: ${darkColors.success}`)}`);
  console.log(`     ${createColorSwatch(darkColors.warning, `Warning: ${darkColors.warning}`)}`);
  console.log(`     ${createColorSwatch(darkColors.error, `Error: ${darkColors.error}`)}`);
  
  console.log(chalk.gray(`\n   Default mode: ${theme.defaultMode}`));
}

export async function gatherProjectConfig(
  projectName: string,
  options: CliOptions
): Promise<ProjectConfig> {
  console.log(chalk.cyan('\n🚀 Creating a new Skuilder course application\n'));

  let config: Partial<ProjectConfig> = {
    projectName
  };

  if (options.interactive) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: 'Course title:',
        default: formatProjectName(projectName),
        validate: (input: string) => input.trim().length > 0 || 'Course title is required'
      },
      {
        type: 'list',
        name: 'dataLayerType',
        message: 'Data layer type:',
        choices: [
          {
            name: 'Dynamic (Connect to CouchDB server)',
            value: 'couch'
          },
          {
            name: 'Static (Self-contained JSON files)',
            value: 'static'
          }
        ],
        default: options.dataLayer === 'dynamic' ? 'couch' : 'static'
      },
      {
        type: 'input',
        name: 'couchdbUrl',
        message: 'CouchDB server URL:',
        default: 'http://localhost:5984',
        when: (answers) => answers.dataLayerType === 'couch',
        validate: (input: string) => {
          if (!input.trim()) return 'CouchDB URL is required for dynamic data layer';
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'input',
        name: 'courseId',
        message: 'Course ID to import (optional):',
        when: (answers) => answers.dataLayerType === 'couch'
      },
      {
        type: 'list',
        name: 'themeName',
        message: 'Select theme:',
        choices: [
          {
            name: `Default (Material Blue) ${createThemePreview('default')}`,
            value: 'default'
          },
          {
            name: `Medical (Healthcare Green) ${createThemePreview('medical')}`,
            value: 'medical'
          },
          {
            name: `Educational (Academic Orange) ${createThemePreview('educational')}`,
            value: 'educational'
          },
          {
            name: `Corporate (Professional Gray) ${createThemePreview('corporate')}`,
            value: 'corporate'
          }
        ],
        default: options.theme
      }
    ]);

    config = {
      ...config,
      title: answers.title,
      dataLayerType: answers.dataLayerType,
      couchdbUrl: answers.couchdbUrl,
      course: answers.courseId,
      theme: PREDEFINED_THEMES[answers.themeName]
    };

    // Show comprehensive theme preview
    displayThemePreview(answers.themeName);
  } else {
    // Non-interactive mode: use provided options
    config = {
      projectName,
      title: formatProjectName(projectName),
      dataLayerType: options.dataLayer === 'dynamic' ? 'couch' : 'static',
      couchdbUrl: options.couchdbUrl,
      course: options.courseId,
      theme: PREDEFINED_THEMES[options.theme]
    };

    // Validate required fields for non-interactive mode
    if (config.dataLayerType === 'couch' && !config.couchdbUrl) {
      throw new Error('CouchDB URL is required when using dynamic data layer. Use --couchdb-url option.');
    }
  }

  return config as ProjectConfig;
}

export async function confirmProjectCreation(
  config: ProjectConfig,
  projectPath: string
): Promise<boolean> {
  console.log(chalk.yellow('\n📋 Project Configuration Summary:'));
  console.log(`   Project Name: ${chalk.white(config.projectName)}`);
  console.log(`   Course Title: ${chalk.white(config.title)}`);
  console.log(`   Data Layer: ${chalk.white(config.dataLayerType)}`);
  
  if (config.couchdbUrl) {
    console.log(`   CouchDB URL: ${chalk.white(config.couchdbUrl)}`);
  }
  
  if (config.course) {
    console.log(`   Course ID: ${chalk.white(config.course)}`);
  }
  
  console.log(`   Theme: ${chalk.white(config.theme.name)} ${createThemePreview(config.theme.name)}`);
  console.log(`   Directory: ${chalk.white(projectPath)}`);

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Create project with these settings?',
      default: true
    }
  ]);

  return confirmed;
}



function formatProjectName(projectName: string): string {
  return projectName
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

