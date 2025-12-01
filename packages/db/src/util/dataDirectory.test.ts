// Test suite for cross-platform data directory utilities
import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';

const testHome = '/test/home';

// Mock os module for ESM compatibility
vi.mock('os', () => ({
  homedir: () => testHome
}));

// Mock fs module to prevent actual file system operations
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined)
  }
}));

import { getAppDataDirectory, getDbPath, ensureAppDataDirectory } from './dataDirectory';
import * as fs from 'fs';

// Get reference to the mocked function after import
const mockMkdir = vi.mocked(fs.promises.mkdir);

describe('dataDirectory utilities', () => {

  describe('getAppDataDirectory', () => {
    it('should return correct path using home directory', () => {
      const result = getAppDataDirectory();
      expect(result).toBe(path.join(testHome, '.tuilder'));
    });
  });

  describe('getDbPath', () => {
    it('should return correct database path', () => {
      const dbName = 'userdb-testuser';
      const result = getDbPath(dbName);
      expect(result).toBe(path.join(testHome, '.tuilder', dbName));
    });

    it('should handle special characters in username', () => {
      const dbName = 'userdb-test@user.com';
      const result = getDbPath(dbName);
      expect(result).toBe(path.join(testHome, '.tuilder', dbName));
    });
  });

  describe('ensureAppDataDirectory', () => {
    it('should create directory with correct path and options', async () => {
      mockMkdir.mockClear();

      const result = await ensureAppDataDirectory();

      expect(result).toBe(path.join(testHome, '.tuilder'));
      expect(mockMkdir).toHaveBeenCalledWith(
        path.join(testHome, '.tuilder'),
        { recursive: true }
      );
    });

    it('should handle EEXIST errors gracefully', async () => {
      mockMkdir.mockClear();
      mockMkdir.mockRejectedValueOnce({ code: 'EEXIST' });

      const result = await ensureAppDataDirectory();

      expect(result).toBe(path.join(testHome, '.tuilder'));
    });

    it('should throw on other filesystem errors', async () => {
      mockMkdir.mockClear();
      mockMkdir.mockRejectedValueOnce({
        code: 'EACCES',
        message: 'permission denied'
      });

      await expect(ensureAppDataDirectory()).rejects.toThrow(
        'Failed to create app data directory'
      );
    });
  });
});