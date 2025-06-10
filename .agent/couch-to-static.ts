#!/usr/bin/env node
// packages/db/src/cli/couch-to-static.ts

import { Command } from 'commander';
import PouchDB from 'pouchdb';
import fs from 'fs-extra';
import path from 'path';
import { CouchDBToStaticPacker, PackerConfig } from '../impl/static/packer';
import { logger } from '../util/logger';

const program = new Command();

program
  .name('couch-to-static')
  .description('Convert CouchDB course databases to static files')
  .version('1.0.0');

program
  .command('pack <courseId>')
  .description('Pack a CouchDB course into static files')
  .option('-s, --server <url>', 'CouchDB server URL', 'http://localhost:5984')
  .option('-u, --username <username>', 'CouchDB username')
  .option('-p, --password <password>', 'CouchDB password')
  .option('-o, --output <dir>', 'Output directory', './static-courses')
  .option('-c, --chunk-size <size>', 'Documents per chunk', '1000')
  .option('-a, --attachments', 'Include attachments', false)
  .action(async (courseId, options) => {
    try {
      logger.info(`Packing course: ${courseId}`);

      // Connect to CouchDB
      const dbUrl = `${options.server}/coursedb-${courseId}`;
      const dbOptions: any = {};

      if (options.username && options.password) {
        dbOptions.auth = {
          username: options.username,
          password: options.password,
        };
      }

      const sourceDB = new PouchDB(dbUrl, dbOptions);

      // Create output directory
      const outputDir = path.join(options.output, courseId);
      await fs.ensureDir(outputDir);

      // Configure packer
      const packerConfig: PackerConfig = {
        outputDir,
        chunkSize: parseInt(options.chunkSize),
        includeAttachments: options.attachments,
      };

      const packer = new CouchDBToStaticPacker(packerConfig);

      // Pack the course
      const manifest = await packer.packCourse(sourceDB, courseId);

      logger.info(`Successfully packed course ${courseId}`);
      logger.info(`Output directory: ${outputDir}`);
      logger.info(`Total documents: ${manifest.documentCount}`);
      logger.info(`Chunks created: ${manifest.chunks.length}`);
      logger.info(`Indices created: ${manifest.indices.length}`);
    } catch (error) {
      logger.error('Error packing course:', error);
      process.exit(1);
    }
  });

program
  .command('pack-all')
  .description('Pack all courses from a CouchDB server')
  .option('-s, --server <url>', 'CouchDB server URL', 'http://localhost:5984')
  .option('-u, --username <username>', 'CouchDB username')
  .option('-p, --password <password>', 'CouchDB password')
  .option('-o, --output <dir>', 'Output directory', './static-courses')
  .option('-c, --chunk-size <size>', 'Documents per chunk', '1000')
  .action(async (options) => {
    try {
      // Connect to course lookup database
      const lookupUrl = `${options.server}/coursedb-lookup`;
      const dbOptions: any = {};

      if (options.username && options.password) {
        dbOptions.auth = {
          username: options.username,
          password: options.password,
        };
      }

      const lookupDB = new PouchDB(lookupUrl, dbOptions);
      const allCourses = await lookupDB.allDocs({ include_docs: true });

      logger.info(`Found ${allCourses.rows.length} courses to pack`);

      // Pack each course
      for (const row of allCourses.rows) {
        const courseId = row.id;
        logger.info(`Packing course: ${courseId}`);

        try {
          const courseUrl = `${options.server}/coursedb-${courseId}`;
          const courseDB = new PouchDB(courseUrl, dbOptions);

          const outputDir = path.join(options.output, courseId);
          await fs.ensureDir(outputDir);

          const packerConfig: PackerConfig = {
            outputDir,
            chunkSize: parseInt(options.chunkSize),
            includeAttachments: false,
          };

          const packer = new CouchDBToStaticPacker(packerConfig);
          await packer.packCourse(courseDB, courseId);

          logger.info(`Successfully packed course ${courseId}`);
        } catch (error) {
          logger.error(`Failed to pack course ${courseId}:`, error);
        }
      }

      // Create master manifest
      await createMasterManifest(options.output);
    } catch (error) {
      logger.error('Error packing courses:', error);
      process.exit(1);
    }
  });

program
  .command('verify <courseId>')
  .description('Verify a packed course can be read correctly')
  .option('-d, --dir <dir>', 'Static courses directory', './static-courses')
  .action(async (courseId, options) => {
    try {
      const courseDir = path.join(options.dir, courseId);
      const manifestPath = path.join(courseDir, 'manifest.json');

      if (!(await fs.pathExists(manifestPath))) {
        throw new Error(`Manifest not found at ${manifestPath}`);
      }

      const manifest = await fs.readJson(manifestPath);
      logger.info(`Verifying course: ${courseId}`);
      logger.info(`Course name: ${manifest.courseName}`);
      logger.info(`Document count: ${manifest.documentCount}`);

      // Verify all chunks exist
      let missingChunks = 0;
      for (const chunk of manifest.chunks) {
        const chunkPath = path.join(courseDir, chunk.path);
        if (!(await fs.pathExists(chunkPath))) {
          logger.error(`Missing chunk: ${chunk.path}`);
          missingChunks++;
        }
      }

      // Verify all indices exist
      let missingIndices = 0;
      for (const index of manifest.indices) {
        const indexPath = path.join(courseDir, index.path);
        if (!(await fs.pathExists(indexPath))) {
          logger.error(`Missing index: ${index.path}`);
          missingIndices++;
        }
      }

      if (missingChunks === 0 && missingIndices === 0) {
        logger.info('✓ All files verified successfully');
      } else {
        logger.error(`✗ Missing ${missingChunks} chunks and ${missingIndices} indices`);
        process.exit(1);
      }
    } catch (error) {
      logger.error('Error verifying course:', error);
      process.exit(1);
    }
  });

async function createMasterManifest(outputDir: string) {
  const courses = await fs.readdir(outputDir);
  const masterManifest: any = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    courses: {},
  };

  for (const courseId of courses) {
    const manifestPath = path.join(outputDir, courseId, 'manifest.json');
    if (await fs.pathExists(manifestPath)) {
      const manifest = await fs.readJson(manifestPath);
      masterManifest.courses[courseId] = {
        name: manifest.courseName,
        documentCount: manifest.documentCount,
        lastUpdated: manifest.lastUpdated,
      };
    }
  }

  await fs.writeJson(path.join(outputDir, 'master-manifest.json'), masterManifest, { spaces: 2 });

  logger.info('Created master manifest');
}

program.parse(process.argv);
