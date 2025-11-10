import { Command } from 'commander';
import PouchDB from 'pouchdb';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { CouchDBToStaticPacker } from '@vue-skuilder/db/packer';

export function createPackCommand(): Command {
  return new Command('pack')
    .description('Pack a CouchDB course into static files')
    .argument('<courseId>', 'Course ID to pack')
    .option('-s, --server <url>', 'CouchDB server URL', 'http://localhost:5984')
    .option('-u, --username <username>', 'CouchDB username')
    .option('-p, --password <password>', 'CouchDB password')
    .option('-o, --output <dir>', 'Output directory', './static-courses')
    .option('-c, --chunk-size <size>', 'Documents per chunk', '1000')
    .option('--no-attachments', 'Exclude attachments')
    .action(packCourse);
}

interface PackOptions {
  server: string;
  username?: string;
  password?: string;
  output: string;
  chunkSize: string;
  noAttachments: boolean;
}

export async function packCourse(courseId: string, options: PackOptions) {
  try {
    console.log(chalk.cyan(`🔧 Packing course: ${courseId}`));
    
    // Validate courseId
    if (!courseId || courseId.trim() === '') {
      throw new Error('Course ID is required');
    }

    // Connect to CouchDB
    const dbUrl = `${options.server}/coursedb-${courseId}`;
    const dbOptions: Record<string, unknown> = {};

    if (options.username && options.password) {
      dbOptions.auth = {
        username: options.username,
        password: options.password,
      };
    }

    console.log(chalk.gray(`📡 Connecting to: ${dbUrl}`));
    const sourceDB = new PouchDB(dbUrl, dbOptions);

    // Test connection
    try {
      await sourceDB.info();
      console.log(chalk.green('✅ Connected to database'));
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      throw new Error(`Failed to connect to database: ${errorMessage}`);
    }

    // Configure packer
    const packerConfig = {
      chunkSize: parseInt(options.chunkSize),
      includeAttachments: !options.noAttachments,
    };

    console.log(chalk.gray(`📦 Chunk size: ${packerConfig.chunkSize} documents`));
    console.log(chalk.gray(`📎 Include attachments: ${packerConfig.includeAttachments}`));

    // Create output directory
    const outputDir = path.resolve(options.output, courseId);
    await fs.ensureDir(outputDir);
    console.log(chalk.gray(`📁 Output directory: ${outputDir}`));

    // Create FileSystemAdapter for the packer
    const fsAdapter = {
      async readFile(filePath: string): Promise<string> {
        return await fs.readFile(filePath, 'utf8');
      },
      async readBinary(filePath: string): Promise<Buffer> {
        return await fs.readFile(filePath);
      },
      async exists(filePath: string): Promise<boolean> {
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      },
      async stat(filePath: string) {
        const stats = await fs.stat(filePath);
        return {
          isDirectory: () => stats.isDirectory(),
          isFile: () => stats.isFile(),
          size: stats.size
        };
      },
      async writeFile(filePath: string, data: string | Buffer): Promise<void> {
        await fs.writeFile(filePath, data);
      },
      async writeJson(filePath: string, data: unknown, options?: { spaces?: number }): Promise<void> {
        await fs.writeJson(filePath, data, options);
      },
      async ensureDir(dirPath: string): Promise<void> {
        await fs.ensureDir(dirPath);
      },
      joinPath(...segments: string[]): string {
        return path.join(...segments);
      },
      dirname(filePath: string): string {
        return path.dirname(filePath);
      },
      isAbsolute(filePath: string): boolean {
        return path.isAbsolute(filePath);
      }
    };

    // Pack the course using the new packCoursePackage method
    console.log(chalk.cyan('🔄 Processing course data...'));
    const packer = new CouchDBToStaticPacker(packerConfig);
    const packResult = await packer.packCoursePackage(sourceDB, courseId, outputDir, fsAdapter);

    // Success summary
    console.log(chalk.green('\n✅ Successfully packed course!'));
    console.log(chalk.white(`📊 Course: ${packResult.manifest.courseName}`));
    console.log(chalk.white(`📄 Documents: ${packResult.manifest.documentCount}`));
    console.log(chalk.white(`🗂️  Chunks: ${packResult.manifest.chunks.length}`));
    console.log(chalk.white(`🗃️  Indices: ${packResult.manifest.indices.length}`));
    console.log(chalk.white(`📎 Attachments: ${packResult.attachmentsFound}`));
    console.log(chalk.white(`📝 Files written: ${packResult.filesWritten}`));
    console.log(chalk.white(`📁 Location: ${outputDir}`));

  } catch (error: unknown) {
    console.error(chalk.red('\n❌ Packing failed:'));
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