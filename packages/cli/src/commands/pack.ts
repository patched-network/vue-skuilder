import { Command } from 'commander';
import PouchDB from 'pouchdb';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { CouchDBToStaticPacker, AttachmentData } from '@vue-skuilder/db/packer';

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

    // Create course-level skuilder.json for the packed course
    const courseTitle = packedData.manifest.courseName || packedData.manifest.courseId || courseId;
    const courseSkuilderJson = {
      name: `@skuilder/course-${courseId}`,
      version: '1.0.0',
      description: courseTitle,
      content: {
        type: 'static',
        manifest: './manifest.json',
      },
    };

    await fs.writeJson(
      path.join(outputDir, 'skuilder.json'),
      courseSkuilderJson,
      { spaces: 2 }
    );
    console.log(chalk.gray(`📄 Created skuilder.json`));

    // Success summary
    console.log(chalk.green('\n✅ Successfully packed course!'));
    console.log(chalk.white(`📊 Course: ${packedData.manifest.courseName}`));
    console.log(chalk.white(`📄 Documents: ${packedData.manifest.documentCount}`));
    console.log(chalk.white(`🗂️  Chunks: ${packedData.manifest.chunks.length}`));
    console.log(chalk.white(`🗃️  Indices: ${packedData.manifest.indices.length}`));
    if (packedData.attachments && packedData.attachments.size > 0) {
      console.log(chalk.white(`📎 Attachments: ${packedData.attachments.size}`));
    }
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
  attachments?: Map<string, AttachmentData>;
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

  // Write attachments
  if (packedData.attachments && packedData.attachments.size > 0) {
    console.log(chalk.cyan('📎 Writing attachments...'));
    
    let attachmentCount = 0;
    for (const [attachmentPath, attachmentData] of packedData.attachments) {
      const fullAttachmentPath = path.join(outputDir, attachmentPath);
      
      // Ensure directory exists
      await fs.ensureDir(path.dirname(fullAttachmentPath));
      
      // Write binary file
      await fs.writeFile(fullAttachmentPath, attachmentData.buffer);
      attachmentCount++;
    }
    
    console.log(chalk.gray(`📎 Wrote ${attachmentCount} attachment files`));
  }
}