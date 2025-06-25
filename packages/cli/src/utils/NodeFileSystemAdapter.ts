// packages/cli/src/utils/NodeFileSystemAdapter.ts

import fs from 'fs';
import path from 'path';
import { FileSystemAdapter, FileStats, FileSystemError } from '@vue-skuilder/db';

/**
 * Node.js implementation of FileSystemAdapter using native fs and path modules.
 * This works cleanly in CLI environments without bundling issues.
 */
export class NodeFileSystemAdapter implements FileSystemAdapter {
  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
      throw new FileSystemError(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        'readFile',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  async readBinary(filePath: string): Promise<Buffer> {
    try {
      return await fs.promises.readFile(filePath);
    } catch (error) {
      throw new FileSystemError(
        `Failed to read binary file: ${error instanceof Error ? error.message : String(error)}`,
        'readBinary',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async stat(filePath: string): Promise<FileStats> {
    try {
      const stats = await fs.promises.stat(filePath);
      return {
        isDirectory: () => stats.isDirectory(),
        isFile: () => stats.isFile(),
        size: stats.size
      };
    } catch (error) {
      throw new FileSystemError(
        `Failed to stat file: ${error instanceof Error ? error.message : String(error)}`,
        'stat',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  joinPath(...segments: string[]): string {
    return path.join(...segments);
  }

  isAbsolute(filePath: string): boolean {
    return path.isAbsolute(filePath);
  }
}