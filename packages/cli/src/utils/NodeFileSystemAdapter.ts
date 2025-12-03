// packages/cli/src/utils/NodeFileSystemAdapter.ts

import fs from 'fs';
import fse from 'fs-extra';
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
        size: stats.size,
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

  async writeFile(filePath: string, data: string | Buffer): Promise<void> {
    try {
      await fse.writeFile(filePath, data as string | Uint8Array);
    } catch (error) {
      throw new FileSystemError(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        'writeFile',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  async writeJson(filePath: string, data: unknown, options?: { spaces?: number }): Promise<void> {
    try {
      await fse.writeJson(filePath, data, options);
    } catch (error) {
      throw new FileSystemError(
        `Failed to write JSON file: ${error instanceof Error ? error.message : String(error)}`,
        'writeJson',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  async ensureDir(dirPath: string): Promise<void> {
    try {
      await fse.ensureDir(dirPath);
    } catch (error) {
      throw new FileSystemError(
        `Failed to ensure directory: ${error instanceof Error ? error.message : String(error)}`,
        'ensureDir',
        dirPath,
        error instanceof Error ? error : undefined
      );
    }
  }

  joinPath(...segments: string[]): string {
    return path.join(...segments);
  }

  dirname(filePath: string): string {
    return path.dirname(filePath);
  }

  isAbsolute(filePath: string): boolean {
    return path.isAbsolute(filePath);
  }
}
