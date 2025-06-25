// packages/db/src/util/migrator/FileSystemAdapter.ts

/**
 * Abstraction for file system operations needed by the migrator.
 * This allows dependency injection of file system operations,
 * avoiding bundling issues with Node.js fs module.
 */
export interface FileSystemAdapter {
  /**
   * Read a text file and return its contents as a string
   */
  readFile(filePath: string): Promise<string>;

  /**
   * Read a binary file and return its contents as a Buffer
   */
  readBinary(filePath: string): Promise<Buffer>;

  /**
   * Check if a file or directory exists
   */
  exists(filePath: string): Promise<boolean>;

  /**
   * Get file/directory statistics
   */
  stat(filePath: string): Promise<FileStats>;

  /**
   * Join path segments into a complete path
   */
  joinPath(...segments: string[]): string;

  /**
   * Check if a path is absolute
   */
  isAbsolute(filePath: string): boolean;
}

export interface FileStats {
  isDirectory(): boolean;
  isFile(): boolean;
  size: number;
}

/**
 * Error thrown when file system operations fail
 */
export class FileSystemError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}