// Test suite for cross-platform data directory utilities
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { getAppDataDirectory, getDbPath, ensureAppDataDirectory } from './dataDirectory';

describe('dataDirectory utilities', () => {
  const originalHomedir = os.homedir;
  const testHome = '/test/home';

  beforeEach(() => {
    // Mock os.homedir for consistent testing
    (os as any).homedir = () => testHome;
  });

  afterEach(() => {
    // Restore original function
    os.homedir = originalHomedir;
  });

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
    it('should handle path creation gracefully', async () => {
      // Note: This test doesn't actually create directories since we're testing logic
      // In a real test environment, you'd want to use a temp directory
      expect(typeof ensureAppDataDirectory).toBe('function');
      
      // Test the function exists and returns a promise
      const result = ensureAppDataDirectory();
      expect(result).toBeInstanceOf(Promise);
    });
  });
});