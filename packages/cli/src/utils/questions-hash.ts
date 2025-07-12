import { createHash } from 'crypto';
import { promises as fs, existsSync } from 'fs';
import path from 'path';

/**
 * Calculate hash of src/questions/ directory contents
 * Returns consistent hash based on file names, content, and modification times
 */
export async function hashQuestionsDirectory(coursePath: string): Promise<string> {
  const questionsPath = path.join(coursePath, 'src', 'questions');
  
  // If questions directory doesn't exist, return special "no-questions" hash
  if (!existsSync(questionsPath)) {
    return 'no-questions';
  }

  const hash = createHash('sha256');
  
  try {
    // Get all files recursively, sort for consistent ordering
    const files = await getAllFiles(questionsPath);
    files.sort();
    
    // If no files, return "empty-questions" hash
    if (files.length === 0) {
      return 'empty-questions';
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
    
    return hash.digest('hex').substring(0, 12); // First 12 chars for readability
  } catch (error) {
    console.warn(`Warning: Failed to hash questions directory: ${error}`);
    return 'hash-error';
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
export async function ensureBuildDirectory(coursePath: string, questionsHash: string): Promise<string> {
  const buildPath = getStudioBuildPath(coursePath, questionsHash);
  await fs.mkdir(buildPath, { recursive: true });
  return buildPath;
}