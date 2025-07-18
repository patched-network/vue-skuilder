import { Status } from '@vue-skuilder/common';
import logger from '../logger.js';
import ENV from '../utils/env.js';
import PouchDb from 'pouchdb';

interface PackCourseData {
  courseId: string;
  outputPath?: string;
}

interface PackCourseResponse {
  status: Status;
  ok: boolean;
  packedFiles?: never; // No longer relevant since we're writing to files
  outputPath?: string;
  attachmentsFound?: number;
  filesWritten?: number;
  totalFiles?: number;
  duration?: number;
  errorText?: string;
}

export async function packCourse(data: PackCourseData): Promise<PackCourseResponse> {
  logger.info(`Starting PACK_COURSE for ${data.courseId}...`);
  
  try {
    const startTime = Date.now();
    
    // Use CouchDBToStaticPacker directly from db package
    const { CouchDBToStaticPacker } = await import('@vue-skuilder/db');
    
    // Create database connection URL
    const dbUrl = `${ENV.COUCHDB_PROTOCOL}://${ENV.COUCHDB_ADMIN}:${ENV.COUCHDB_PASSWORD}@${ENV.COUCHDB_SERVER}`;
    const dbName = `coursedb-${data.courseId}`;
    
    // Determine output path based on environment and provided path
    let outputPath: string;
    
    if (data.outputPath) {
      // If output path is provided, check if it's absolute or relative
      const pathModule = await import('path');
      const path = pathModule.default || pathModule;
      
      if (path.isAbsolute(data.outputPath)) {
        // Use absolute path as-is
        outputPath = data.outputPath;
      } else {
        // Relative path - combine with project path in studio mode
        const projectPath = process.env.PROJECT_PATH || process.cwd();
        outputPath = path.join(projectPath, data.outputPath);
      }
    } else {
      // No output path provided - use default
      outputPath = ENV.NODE_ENV === 'studio' ?
        '/tmp/skuilder-studio-output' :
        process.cwd();
    }
    
    logger.info(`Packing course ${data.courseId} from ${dbName} to ${outputPath}`);
    
    // Clean up existing output directory for replace-in-place functionality
    const fsExtra = await import('fs-extra');
    const fs = fsExtra.default || fsExtra;
    
    try {
      if (await fs.pathExists(outputPath)) {
        logger.info(`Removing existing directory: ${outputPath}`);
        await fs.remove(outputPath);
      }
    } catch (cleanupError) {
      logger.warn(`Warning: Could not clean up existing directory ${outputPath}:`, cleanupError);
      // Continue anyway - the write operation might still succeed
    }
    
    // Create course database connection
    const courseDbUrl = `${dbUrl}/${dbName}`;
    
    // Initialize packer and perform pack operation with file writing
    const packer = new CouchDBToStaticPacker();
    
    // For Express, we create a simple FileSystemAdapter using dynamic imports
    const createFsAdapter = async () => {
      const fsExtra = await import('fs-extra');
      const pathModule = await import('path');
      
      // Access the default export for fs-extra
      const fs = fsExtra.default || fsExtra;
      const path = pathModule.default || pathModule;
      
      return {
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
    };
    
    const fsAdapter = await createFsAdapter();
    const packResult = await packer.packCourseToFiles(new PouchDb(courseDbUrl), data.courseId, outputPath, fsAdapter);
    
    const duration = Date.now() - startTime;
    
    const response: PackCourseResponse = {
      status: Status.ok,
      ok: true,
      outputPath: outputPath,
      attachmentsFound: packResult.attachmentsFound,
      filesWritten: packResult.filesWritten,
      totalFiles: packResult.filesWritten, // Updated to reflect actual files written
      duration: duration
    };
    
    logger.info(`Pack completed in ${duration}ms. Attachments: ${response.attachmentsFound}, Files written: ${response.filesWritten}`);
    
    return response;
  } catch (error) {
    logger.error('Pack operation failed:', error);
    
    const response: PackCourseResponse = {
      status: Status.error,
      ok: false,
      errorText: error instanceof Error ? error.message : 'Pack operation failed'
    };
    
    return response;
  }
}

// Export types for use in app.ts
export type { PackCourseData, PackCourseResponse };