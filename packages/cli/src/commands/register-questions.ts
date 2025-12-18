import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import {
  initializeDataLayer,
  getDataLayer,
  registerCustomQuestionTypes,
  type CustomQuestionsData,
} from '@vue-skuilder/db';

export function createRegisterQuestionsCommand(): Command {
  return new Command('register-questions')
    .description('Register custom question types from dist-lib/questions.mjs to CouchDB CourseConfig')
    .option('-u, --user <username>', 'CouchDB username (required)')
    .option('-p, --password <password>', 'CouchDB password (required)')
    .option('--config <path>', 'Path to skuilder.config.json', 'skuilder.config.json')
    .option('--questions <path>', 'Path to questions module', 'dist-lib/questions.mjs')
    .option('--dry-run', 'Show what would be registered without making changes')
    .action(registerQuestions)
    .addHelpText(
      'after',
      `
Register custom question types (DataShapes) with a remote CouchDB course database.

This command is designed for standalone Skuilder apps that define custom question
types. Instead of registering on every page load, run this once (or when question
types change) to update the CourseConfig document in CouchDB.

Prerequisites:
  1. Build your questions library: yarn build:lib (or npm run build:lib)
  2. Have a valid skuilder.config.json with 'course' and 'couchdbUrl' fields
  3. CouchDB credentials with write access to the course database

Example:
  # In your standalone app directory after building
  npx @vue-skuilder/cli register-questions --user admin --password secret

  # With custom paths
  npx @vue-skuilder/cli register-questions \\
    --config ./my-config.json \\
    --questions ./build/questions.mjs \\
    --user admin --password secret

  # Preview changes without writing
  npx @vue-skuilder/cli register-questions --dry-run --user admin --password secret
`
    );
}

interface SkuilderConfig {
  course?: string;
  couchdbUrl?: string;
  dataLayerType?: 'static' | 'couch';
  title?: string;
}

interface RegisterQuestionsOptions {
  user?: string;
  password?: string;
  config: string;
  questions: string;
  dryRun?: boolean;
}

async function registerQuestions(options: RegisterQuestionsOptions) {
  try {
    console.log(chalk.cyan('📋 Registering custom question types...'));

    // Validate required options
    if (!options.user || !options.password) {
      console.error(chalk.red('❌ Error: --user and --password are required'));
      console.error(chalk.gray('   Use --help for usage information'));
      process.exit(1);
    }

    // Read skuilder.config.json
    const configPath = path.resolve(process.cwd(), options.config);
    console.log(chalk.gray(`📁 Config: ${configPath}`));

    if (!fs.existsSync(configPath)) {
      console.error(chalk.red(`❌ Error: Config file not found: ${configPath}`));
      console.error(chalk.gray('   Create skuilder.config.json or specify path with --config'));
      process.exit(1);
    }

    let config: SkuilderConfig;
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(configContent);
    } catch (parseError) {
      console.error(chalk.red(`❌ Error: Failed to parse config file: ${configPath}`));
      console.error(
        chalk.gray(`   ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      );
      process.exit(1);
    }

    // Validate config has required fields
    if (!config.course) {
      console.error(chalk.red('❌ Error: Config missing required field: course'));
      console.error(chalk.gray('   Add "course": "your-course-id" to skuilder.config.json'));
      process.exit(1);
    }

    if (!config.couchdbUrl) {
      console.error(chalk.red('❌ Error: Config missing required field: couchdbUrl'));
      console.error(
        chalk.gray('   Add "couchdbUrl": "https://your-server.com/couch" to skuilder.config.json')
      );
      process.exit(1);
    }

    console.log(chalk.gray(`📚 Course: ${config.course}`));
    console.log(chalk.gray(`🔗 CouchDB: ${config.couchdbUrl}`));

    // Load questions module
    const questionsPath = path.resolve(process.cwd(), options.questions);
    console.log(chalk.gray(`📦 Questions: ${questionsPath}`));

    if (!fs.existsSync(questionsPath)) {
      console.error(chalk.red(`❌ Error: Questions module not found: ${questionsPath}`));
      console.error(chalk.gray('   Run "yarn build:lib" or "npm run build:lib" first'));
      process.exit(1);
    }

    let customQuestions: CustomQuestionsData;
    try {
      // Use pathToFileURL for proper ESM import on all platforms
      const questionsUrl = pathToFileURL(questionsPath).href;
      const questionsModule = await import(questionsUrl);

      if (typeof questionsModule.allCustomQuestions !== 'function') {
        console.error(chalk.red('❌ Error: Questions module missing allCustomQuestions() export'));
        console.error(
          chalk.gray('   Ensure your questions/index.ts exports allCustomQuestions function')
        );
        process.exit(1);
      }

      customQuestions = questionsModule.allCustomQuestions();
      console.log(
        chalk.green(
          `✅ Loaded ${customQuestions.questionClasses?.length || 0} question types from module`
        )
      );
    } catch (importError) {
      console.error(chalk.red(`❌ Error: Failed to import questions module`));
      console.error(
        chalk.gray(`   ${importError instanceof Error ? importError.message : String(importError)}`)
      );
      process.exit(1);
    }

    // Display what will be registered
    console.log(chalk.cyan('\n📊 Question types to register:'));
    if (customQuestions.questionClasses && customQuestions.questionClasses.length > 0) {
      customQuestions.questionClasses.forEach((qc) => {
        const dataShapeNames = qc.dataShapes?.map((ds) => ds.name).join(', ') || 'none';
        console.log(chalk.white(`   • ${qc.name}`));
        console.log(chalk.gray(`     DataShapes: ${dataShapeNames}`));
      });
    } else {
      console.log(chalk.yellow('   (no question types found)'));
    }

    console.log(chalk.cyan('\n📋 DataShapes to register:'));
    if (customQuestions.dataShapes && customQuestions.dataShapes.length > 0) {
      customQuestions.dataShapes.forEach((ds) => {
        console.log(chalk.white(`   • ${ds.name}`));
      });
    } else {
      console.log(chalk.yellow('   (no standalone DataShapes found)'));
    }

    // Dry run - stop here
    if (options.dryRun) {
      console.log(chalk.yellow('\n🔍 Dry run complete - no changes made'));
      return;
    }

    // Initialize data layer connection
    console.log(chalk.cyan('\n🔗 Connecting to CouchDB...'));

    const couchUrl = new URL(config.couchdbUrl);
    const serverUrl = `${couchUrl.hostname}:${couchUrl.port || (couchUrl.protocol === 'https:' ? '443' : '80')}/`;

    await initializeDataLayer({
      type: 'couch',
      options: {
        COUCHDB_SERVER_PROTOCOL: couchUrl.protocol.replace(':', ''),
        COUCHDB_SERVER_URL: serverUrl,
        COUCHDB_USERNAME: options.user,
        COUCHDB_PASSWORD: options.password,
      },
    });

    console.log(chalk.green('✅ Connected to CouchDB'));

    // Get course database and config
    const courseDB = getDataLayer().getCourseDB(config.course);
    const courseConfig = await courseDB.getCourseConfig();

    console.log(chalk.gray(`📄 Current CourseConfig has ${courseConfig.dataShapes.length} DataShapes`));
    console.log(
      chalk.gray(`📄 Current CourseConfig has ${courseConfig.questionTypes.length} QuestionTypes`)
    );

    // Register custom question types
    console.log(chalk.cyan('\n📝 Registering question types...'));

    const result = await registerCustomQuestionTypes(
      customQuestions,
      courseConfig,
      courseDB,
      options.user // Use provided username for seed data attribution
    );

    if (result.success) {
      console.log(chalk.green(`\n✅ Registration complete!`));
      console.log(chalk.white(`   Items registered/updated: ${result.registeredCount}`));

      // Show updated counts
      const updatedConfig = await courseDB.getCourseConfig();
      console.log(
        chalk.gray(`   CourseConfig now has ${updatedConfig.dataShapes.length} DataShapes`)
      );
      console.log(
        chalk.gray(`   CourseConfig now has ${updatedConfig.questionTypes.length} QuestionTypes`)
      );
    } else {
      console.error(chalk.red(`\n❌ Registration failed: ${result.errorMessage}`));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'));
    console.error(
      chalk.red(`   ${error instanceof Error ? error.message : String(error)}`)
    );

    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error instanceof Error ? error.stack : 'No stack trace'));
    }

    process.exit(1);
  }
}
