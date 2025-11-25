import { createHash } from 'crypto';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { VERSION } from '../cli.js';

/**
 * Calculate composite hash of src/questions/ directory contents + CLI version
 *
 * Returns consistent hash based on:
 * - File names, content, and modification times in src/questions/
 * - CLI version (ensures cache invalidation when CLI updates with new studio-ui code)
 *
 * Cache Invalidation Strategy:
 * - Questions change: Different file content/mtime → new hash → cache miss → rebuild
 * - CLI updates: Different VERSION → new hash → cache miss → rebuild with new studio-ui
 * - This solves the problem where CLI updates with new studio-ui features weren't
 *   being picked up by existing cached builds
 *
 * Special Cases:
 * - No questions directory: Returns "no-questions-{version-hash}"
 * - Empty questions directory: Returns "empty-questions-{version-hash}"
 * - Hash error: Returns "hash-error-{version-hash}"
 */
export async function hashQuestionsDirectory(coursePath: string): Promise<string> {
  const questionsPath = path.join(coursePath, 'src', 'questions');

  // If questions directory doesn't exist, return special "no-questions" hash with CLI version
  if (!existsSync(questionsPath)) {
    const hash = createHash('sha256');
    hash.update(`no-questions:${VERSION}`);
    return `no-questions-${hash.digest('hex').substring(0, 8)}`;
  }

  const hash = createHash('sha256');

  try {
    // Get all files recursively, sort for consistent ordering
    const files = await getAllFiles(questionsPath);
    files.sort();

    // If no files, return "empty-questions" hash with CLI version
    if (files.length === 0) {
      const emptyHash = createHash('sha256');
      emptyHash.update(`empty-questions:${VERSION}`);
      return `empty-questions-${emptyHash.digest('hex').substring(0, 8)}`;
    }

    // Hash each file's relative path, content, and mtime
    for (const file of files) {
      const relativePath = path.relative(questionsPath, file);
      const stat = await fs.stat(file);
      const content = await fs.readFile(file);

      // Include relative path, modification time, and content in hash
      hash.update(relativePath);
      hash.update(stat.mtime.toISOString());
      hash.update(content);
    }

    // Include CLI version in hash for cache invalidation on CLI updates
    hash.update(`cli-version:${VERSION}`);

    return hash.digest('hex').substring(0, 12); // First 12 chars for readability
  } catch (error) {
    console.warn(`Warning: Failed to hash questions directory: ${error}`);
    const errorHash = createHash('sha256');
    errorHash.update(`hash-error:${VERSION}`);
    return `hash-error-${errorHash.digest('hex').substring(0, 8)}`;
  }
}

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively get files from subdirectories
        const subFiles = await getAllFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Only include source files (TypeScript, Vue, JavaScript)
        if (/\.(ts|vue|js|tsx|jsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // If directory can't be read, return empty array
    console.warn(`Warning: Could not read directory ${dirPath}: ${error}`);
  }

  return files;
}

/**
 * Get the studio build directory path for a given questions hash
 *
 * The questionsHash parameter already includes CLI version, creating version-aware cache directories:
 * - .skuilder/studio-builds/a1b2c3d4e5f6/ (normal questions + CLI v0.1.15)
 * - .skuilder/studio-builds/f6e5d4c3b2a1/ (same questions + CLI v0.1.16)
 *
 * This ensures that CLI updates automatically get fresh cache entries with updated studio-ui code.
 */
export function getStudioBuildPath(coursePath: string, questionsHash: string): string {
  return path.join(coursePath, '.skuilder', 'studio-builds', questionsHash);
}

/**
 * Check if a studio build exists for the given questions hash
 */
export function studioBuildExists(coursePath: string, questionsHash: string): boolean {
  const buildPath = getStudioBuildPath(coursePath, questionsHash);
  return existsSync(path.join(buildPath, 'index.html'));
}

/**
 * Ensure the cache directory structure exists
 */
export async function ensureCacheDirectory(coursePath: string): Promise<void> {
  const cacheDir = path.join(coursePath, '.skuilder', 'studio-builds');
  await fs.mkdir(cacheDir, { recursive: true });
}

/**
 * Ensure a specific build directory exists
 */
export async function ensureBuildDirectory(
  coursePath: string,
  questionsHash: string
): Promise<string> {
  const buildPath = getStudioBuildPath(coursePath, questionsHash);
  await fs.mkdir(buildPath, { recursive: true });
  return buildPath;
}
