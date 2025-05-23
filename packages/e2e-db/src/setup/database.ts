import nano from 'nano';

export class DatabaseManager {
  private couch: nano.ServerScope;
  private testDatabases: Set<string> = new Set();

  constructor(couchUrl: string) {
    this.couch = nano(couchUrl);
  }

  async waitForDatabase(maxAttempts: number = 30): Promise<void> {
    console.log('⏳ Waiting for CouchDB to be ready...');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.couch.db.list();
        console.log('✅ CouchDB is ready');
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(`CouchDB not ready after ${maxAttempts} attempts`);
        }
        console.log(`⏳ Attempt ${attempt}/${maxAttempts} - waiting for CouchDB...`);
        await this.sleep(1000);
      }
    }
  }

  async documentExists(username: string, documentId: string): Promise<boolean> {
    const dbName = this.getUserDbName(username);

    try {
      const db = this.couch.db.use(dbName);
      await db.get(documentId);
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async getDocument(username: string, documentId: string): Promise<any> {
    const dbName = this.getUserDbName(username);
    const db = this.couch.db.use(dbName);
    return await db.get(documentId);
  }

  async getScheduledReviewCount(username: string): Promise<number> {
    const dbName = this.getUserDbName(username);

    try {
      const db = this.couch.db.use(dbName);
      const result = await db.find({
        selector: {
          _id: { $regex: '^review-' },
        },
      });
      return result.docs.length;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return 0; // Database doesn't exist yet
      }
      throw error;
    }
  }

  async getAllScheduledReviews(username: string): Promise<any[]> {
    const dbName = this.getUserDbName(username);

    try {
      const db = this.couch.db.use(dbName);
      const result = await db.find({
        selector: {
          _id: { $regex: '^review-' },
        },
      });
      return result.docs;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return []; // Database doesn't exist yet
      }
      throw error;
    }
  }

  async userDatabaseExists(username: string): Promise<boolean> {
    const dbName = this.getUserDbName(username);

    try {
      const db = this.couch.db.use(dbName);
      await db.info();
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async createTestUser(username: string): Promise<void> {
    const dbName = this.getUserDbName(username);
    this.testDatabases.add(dbName);

    try {
      await this.couch.db.create(dbName);
      console.log(`📁 Created test database: ${dbName}`);
    } catch (error: any) {
      if (error.statusCode === 412) {
        // Database already exists, that's okay for tests
        console.log(`📁 Test database already exists: ${dbName}`);
      } else {
        throw error;
      }
    }
  }

  async cleanupTestData(): Promise<void> {
    // Clean up individual test data without destroying databases
    for (const dbName of this.testDatabases) {
      try {
        const db = this.couch.db.use(dbName);

        // Get all documents with review prefix
        const result = await db.find({
          selector: {
            _id: { $regex: '^review-' },
          },
        });

        // Delete review documents
        for (const doc of result.docs) {
          try {
            await db.destroy(doc._id, doc._rev);
          } catch (error: any) {
            if (error.statusCode !== 404) {
              console.warn(`Warning: Failed to delete document ${doc._id}:`, error.message);
            }
          }
        }
      } catch (error: any) {
        if (error.statusCode !== 404) {
          console.warn(`Warning: Failed to clean up database ${dbName}:`, error.message);
        }
      }
    }
  }

  async cleanupAll(): Promise<void> {
    console.log('🧹 Cleaning up test databases...');

    for (const dbName of this.testDatabases) {
      try {
        await this.couch.db.destroy(dbName);
        console.log(`🗑️ Deleted test database: ${dbName}`);
      } catch (error: any) {
        if (error.statusCode === 404) {
          console.log(`⚠️ Database ${dbName} already deleted`);
        } else {
          console.warn(`Warning: Failed to delete database ${dbName}:`, error.message);
        }
      }
    }

    this.testDatabases.clear();
  }

  private getUserDbName(username: string): string {
    const hexName = this.hexEncode(username);
    return `userdb-${hexName}`;
  }

  private hexEncode(str: string): string {
    let hex: string;
    let returnStr: string = '';

    for (let i = 0; i < str.length; i++) {
      hex = str.charCodeAt(i).toString(16);
      returnStr += ('000' + hex).slice(-4);
    }

    return returnStr;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
