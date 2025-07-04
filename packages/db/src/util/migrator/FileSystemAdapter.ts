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
   * Write text data to a file
   */
  writeFile(filePath: string, data: string | Buffer): Promise<void>;

  /**
   * Write JSON data to a file with formatting
   */
  writeJson(filePath: string, data: any, options?: { spaces?: number }): Promise<void>;

  /**
   * Ensure a directory exists, creating it and parent directories if needed
   */
  ensureDir(dirPath: string): Promise<void>;

  /**
   * Join path segments into a complete path
   */
  joinPath(...segments: string[]): string;

  /**
   * Get the directory name of a path
   */
  dirname(filePath: string): string;

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