import { Command } from 'commander';
import PouchDB from 'pouchdb';
import path from 'path';
import chalk from 'chalk';
import { StaticToCouchDBMigrator, validateStaticCourse, CourseLookup, ENV } from '@vue-skuilder/db';
import { NodeFileSystemAdapter } from '../utils/NodeFileSystemAdapter.js';

export function createUnpackCommand(): Command {
  return new Command('unpack')
    .description('Unpack a static course directory into CouchDB')
    .argument('<coursePath>', 'Path to static course directory')
    .option('-s, --server <url>', 'CouchDB server URL', 'http://localhost:5984')
    .option('-u, --username <username>', 'CouchDB username')
    .option('-p, --password <password>', 'CouchDB password')
    .option('-d, --database <name>', 'Target database name (auto-generated if not provided)')
    .option('--chunk-size <size>', 'Documents per batch', '100')
    .option('--validate', 'Run migration validation')
    .option('--cleanup-on-error', 'Clean up database if migration fails')
    .action(unpackCourse);
}

interface UnpackOptions {
  server: string;
  username?: string;
  password?: string;
  database?: string;
  chunkSize: string;
  validate: boolean;
  cleanupOnError: boolean;
}

async function unpackCourse(coursePath: string, options: UnpackOptions) {
  // Store original ENV values for cleanup
  const originalEnv = {
    COUCHDB_SERVER_PROTOCOL: ENV.COUCHDB_SERVER_PROTOCOL,
    COUCHDB_SERVER_URL: ENV.COUCHDB_SERVER_URL,
    COUCHDB_USERNAME: ENV.COUCHDB_USERNAME,
    COUCHDB_PASSWORD: ENV.COUCHDB_PASSWORD,
  };

  try {
    console.log(chalk.cyan(`🔧 Unpacking static course to CouchDB...`));
    console.log(chalk.gray(`📁 Source: ${path.resolve(coursePath)}`));

    // Create file system adapter
    const fileSystemAdapter = new NodeFileSystemAdapter();

    // Validate static course directory
    console.log(chalk.cyan('🔍 Validating static course...'));
    const validation = await validateStaticCourse(coursePath, fileSystemAdapter);
    
    if (!validation.valid) {
      console.log(chalk.red('❌ Static course validation failed:'));
      validation.errors.forEach((error: string) => {
        console.log(chalk.red(`  • ${error}`));
      });
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('⚠️  Validation warnings:'));
      validation.warnings.forEach((warning: string) => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }

    console.log(chalk.green('✅ Static course validation passed'));
    console.log(chalk.gray(`📋 Course: ${validation.courseName || 'Unknown'} (${validation.courseId || 'Unknown ID'})`));

    // Generate studio course ID and database name if not provided
    let targetDbName = options.database;
    let studioCourseId: string;
    
    if (!targetDbName) {
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.random().toString(36).substring(2, 8);
      studioCourseId = `unpack-${validation.courseId || 'unknown'}-${timestamp}-${random}`;
      targetDbName = `coursedb-${studioCourseId}`;
    } else {
      // If user provided custom database name, extract studio course ID from it
      studioCourseId = targetDbName.startsWith('coursedb-') 
        ? targetDbName.substring(9) 
        : targetDbName;
    }

    // Construct database URL
    const dbUrl = `${options.server}/${targetDbName}`;
    console.log(chalk.gray(`📡 Target: ${dbUrl}`));

    // Setup database connection options
    const dbOptions: Record<string, unknown> = {};
    if (options.username && options.password) {
      dbOptions.auth = {
        username: options.username,
        password: options.password,
      };
    }

    // Create and connect to target database
    console.log(chalk.cyan('🔄 Creating target database...'));
    const targetDB = new PouchDB(dbUrl, dbOptions);

    // Test connection by trying to get database info
    try {
      await targetDB.info();
      console.log(chalk.green('✅ Connected to target database'));
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      throw new Error(`Failed to connect to target database: ${errorMessage}`);
    }

    // Setup ENV variables for CourseLookup (temporarily override for this operation)
    try {
      // Parse server URL to extract protocol and host
      const serverUrl = new URL(options.server);
      ENV.COUCHDB_SERVER_PROTOCOL = serverUrl.protocol.slice(0, -1); // Remove trailing ':'
      ENV.COUCHDB_SERVER_URL = serverUrl.host;
      if (options.username) ENV.COUCHDB_USERNAME = options.username;
      if (options.password) ENV.COUCHDB_PASSWORD = options.password;
    } catch (urlError) {
      throw new Error(`Invalid server URL: ${options.server}`);
    }

    // Configure migrator
    const migratorOptions = {
      chunkBatchSize: parseInt(options.chunkSize),
      validateRoundTrip: options.validate,
      cleanupOnFailure: options.cleanupOnError,
    };

    console.log(chalk.gray(`📦 Batch size: ${migratorOptions.chunkBatchSize} documents`));
    console.log(chalk.gray(`🔍 Validation enabled: ${migratorOptions.validateRoundTrip}`));

    // Setup progress reporting
    const migrator = new StaticToCouchDBMigrator(migratorOptions, fileSystemAdapter);
    migrator.setProgressCallback((progress: any) => {
      const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
      console.log(chalk.cyan(`🔄 ${progress.phase}: ${progress.message} (${progress.current}/${progress.total} - ${percentage}%)`));
    });

    // Perform migration
    console.log(chalk.cyan('🚀 Starting migration...'));
    
    const result = await migrator.migrateCourse(coursePath, targetDB);
    
    if (!result.success) {
      console.log(chalk.red('\n❌ Migration failed:'));
      result.errors.forEach((error: string) => {
        console.log(chalk.red(`  • ${error}`));
      });
      
      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Warnings:'));
        result.warnings.forEach((warning: string) => {
          console.log(chalk.yellow(`  • ${warning}`));
        });
      }
      
      process.exit(1);
    }

    // Success! Register course in lookup and display results
    console.log(chalk.green('\n✅ Successfully unpacked course!'));
    
    try {
      console.log(chalk.cyan('🔄 Registering course in course lookup...'));
      await CourseLookup.addWithId(studioCourseId, validation.courseName || 'Unknown Course');
      console.log(chalk.green('✅ Course registered in course lookup'));
    } catch (lookupError) {
      console.log(chalk.yellow('⚠️  Warning: Failed to register course in lookup database'));
      console.log(chalk.yellow(`   ${lookupError instanceof Error ? lookupError.message : String(lookupError)}`));
      console.log(chalk.yellow('   The unpacked course data is still available, but may not appear in the course browser.'));
    }
    console.log('');
    console.log(chalk.white(`📊 Course: ${validation.courseName || 'Unknown'}`));
    console.log(chalk.white(`📄 Documents: ${result.documentsRestored}`));
    console.log(chalk.white(`🗃️  Design Docs: ${result.designDocsRestored}`));
    console.log(chalk.white(`📎 Attachments: ${result.attachmentsRestored}`));
    console.log(chalk.white(`⏱️  Migration Time: ${(result.migrationTime / 1000).toFixed(1)}s`));
    console.log(chalk.white(`📡 Database: ${targetDbName}`));

    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Migration warnings:'));
      result.warnings.forEach((warning: string) => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }

    // Display next steps
    console.log('');
    console.log(chalk.cyan('📝 Next steps:'));
    console.log(chalk.gray('  • Test the migrated course data in your application'));
    console.log(chalk.gray('  • Verify document counts and content manually if needed'));
    console.log(chalk.gray(`  • Use database: ${targetDbName}`));
    
    if (!options.validate) {
      console.log(chalk.gray('  • Consider running with --validate flag for comprehensive verification'));
    }

  } catch (error: unknown) {
    console.error(chalk.red('\n❌ Unpacking failed:'));
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Show stack trace in development/debug mode
      if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray(error.stack || 'No stack trace available'));
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String((error as { message: unknown }).message);
    }
    
    console.error(chalk.red(errorMessage));
    console.error('');
    console.error(chalk.yellow('💡 Troubleshooting tips:'));
    console.error(chalk.gray('  • Verify the static course directory path is correct'));
    console.error(chalk.gray('  • Ensure CouchDB is running and accessible'));
    console.error(chalk.gray('  • Check that manifest.json and chunks/ directory exist'));
    console.error(chalk.gray('  • Verify database permissions if using authentication'));
    console.error(chalk.gray('  • Use --validate flag for detailed error information'));
    
    process.exit(1);
  } finally {
    // Restore original ENV values
    ENV.COUCHDB_SERVER_PROTOCOL = originalEnv.COUCHDB_SERVER_PROTOCOL;
    ENV.COUCHDB_SERVER_URL = originalEnv.COUCHDB_SERVER_URL;
    ENV.COUCHDB_USERNAME = originalEnv.COUCHDB_USERNAME;
    ENV.COUCHDB_PASSWORD = originalEnv.COUCHDB_PASSWORD;
  }
}