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

async function packCourse(courseId: string, options: PackOptions) {
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

    // Configure packer (data transformation only)
    const packerConfig = {
      chunkSize: parseInt(options.chunkSize),
      includeAttachments: !options.noAttachments,
    };

    console.log(chalk.gray(`📦 Chunk size: ${packerConfig.chunkSize} documents`));
    console.log(chalk.gray(`📎 Include attachments: ${packerConfig.includeAttachments}`));

    // Pack the course (data transformation)
    console.log(chalk.cyan('🔄 Processing course data...'));
    const packer = new CouchDBToStaticPacker(packerConfig);
    const packedData = await packer.packCourse(sourceDB, courseId);

    // Create output directory
    const outputDir = path.resolve(options.output, courseId);
    await fs.ensureDir(outputDir);
    console.log(chalk.gray(`📁 Output directory: ${outputDir}`));

    // Write files
    await writePackedData(packedData, outputDir);

    // Success summary
    console.log(chalk.green('\n✅ Successfully packed course!'));
    console.log(chalk.white(`📊 Course: ${packedData.manifest.courseName}`));
    console.log(chalk.white(`📄 Documents: ${packedData.manifest.documentCount}`));
    console.log(chalk.white(`🗂️  Chunks: ${packedData.manifest.chunks.length}`));
    console.log(chalk.white(`🗃️  Indices: ${packedData.manifest.indices.length}`));
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

interface PackedData {
  manifest: {
    version: string;
    courseId: string;
    courseName: string;
    lastUpdated: string;
    documentCount: number;
    chunks: unknown[];
    indices: unknown[];
    designDocs: unknown[];
  };
  chunks: Map<string, unknown[]>;
  indices: Map<string, unknown>;
}

async function writePackedData(
  packedData: PackedData,
  outputDir: string
) {
  console.log(chalk.cyan('💾 Writing files...'));

  // Write manifest
  const manifestPath = path.join(outputDir, 'manifest.json');
  await fs.writeJson(manifestPath, packedData.manifest, { spaces: 2 });
  console.log(chalk.gray(`📋 Wrote manifest: ${manifestPath}`));

  // Create directories
  const chunksDir = path.join(outputDir, 'chunks');
  const indicesDir = path.join(outputDir, 'indices');
  await fs.ensureDir(chunksDir);
  await fs.ensureDir(indicesDir);

  // Write chunks
  let chunkCount = 0;
  for (const [chunkId, chunkData] of packedData.chunks) {
    const chunkPath = path.join(chunksDir, `${chunkId}.json`);
    await fs.writeJson(chunkPath, chunkData);
    chunkCount++;
  }
  console.log(chalk.gray(`📦 Wrote ${chunkCount} chunks`));

  // Write indices  
  let indexCount = 0;
  for (const [indexName, indexData] of packedData.indices) {
    const indexPath = path.join(indicesDir, `${indexName}.json`);
    await fs.writeJson(indexPath, indexData, { spaces: 2 });
    indexCount++;
  }
  console.log(chalk.gray(`🗃️  Wrote ${indexCount} indices`));
}