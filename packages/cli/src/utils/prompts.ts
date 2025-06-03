import inquirer from 'inquirer';
import chalk from 'chalk';
import { CliOptions, ProjectConfig, PREDEFINED_THEMES } from '../types.js';

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
            name: 'Default (Material Blue)',
            value: 'default'
          },
          {
            name: 'Medical (Healthcare Green)',
            value: 'medical'
          },
          {
            name: 'Educational (Academic Orange)',
            value: 'educational'
          },
          {
            name: 'Corporate (Professional Gray)',
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
  
  console.log(`   Theme: ${chalk.white(config.theme.name)}`);
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

