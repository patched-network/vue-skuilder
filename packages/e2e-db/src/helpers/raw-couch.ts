import nano from 'nano';

export interface RawCouchDBOptions {
  couchUrl: string;
  adminUsername?: string;
  adminPassword?: string;
}

export class RawCouchHelper {
  private couch: nano.ServerScope;

  constructor(options: RawCouchDBOptions) {
    this.couch = nano(options.couchUrl);
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

  async getDocument<T = any>(username: string, documentId: string): Promise<T> {
    const dbName = this.getUserDbName(username);
    const db = this.couch.db.use(dbName);
    return (await db.get(documentId)) as T;
  }

  async getAllDocumentsWithPrefix(username: string, prefix: string): Promise<any[]> {
    const dbName = this.getUserDbName(username);
    
    try {
      const db = this.couch.db.use(dbName);
      const result = await db.list({
        startkey: prefix,
        endkey: prefix + '\ufff0',
        include_docs: true
      });
      
      return result.rows.map((row: any) => row.doc);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return []; // Database doesn't exist
      }
      throw error;
    }
  }

  async getScheduledReviews(username: string): Promise<any[]> {
    return this.getAllDocumentsWithPrefix(username, 'review-');
  }

  async getScheduledReviewCount(username: string): Promise<number> {
    const reviews = await this.getScheduledReviews(username);
    return reviews.length;
  }

  async assertReviewExists(username: string, reviewId: string): Promise<boolean> {
    return this.documentExists(username, reviewId);
  }

  async assertReviewRemoved(username: string, reviewId: string): Promise<boolean> {
    return !(await this.documentExists(username, reviewId));
  }

  async getUserRegistrations(username: string): Promise<string[]> {
    try {
      const registrationDoc = await this.getDocument(username, 'CourseRegistrations');
      return registrationDoc?.registrations?.map((reg: any) => reg.courseId) || [];
    } catch (error: any) {
      if (error.statusCode === 404) {
        return []; // No registrations yet
      }
      throw error;
    }
  }

  async getUserConfig(username: string): Promise<any> {
    try {
      return await this.getDocument(username, 'CONFIG');
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null; // No config yet
      }
      throw error;
    }
  }

  async databaseExists(username: string): Promise<boolean> {
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

  async getDatabaseInfo(username: string): Promise<any> {
    const dbName = this.getUserDbName(username);
    const db = this.couch.db.use(dbName);
    return await db.info();
  }

  async getCardHistory(username: string, cardId: string): Promise<any[]> {
    const prefix = `cardH-${cardId}`;
    return this.getAllDocumentsWithPrefix(username, prefix);
  }

  async getActivityRecords(username: string): Promise<any[]> {
    return this.getAllDocumentsWithPrefix(username, 'activity-');
  }

  async insertTestDocument(username: string, docId: string, content: any): Promise<any> {
    const dbName = this.getUserDbName(username);
    const db = this.couch.db.use(dbName);

    const doc = {
      _id: docId,
      ...content,
      _test_document: true, // Mark as test document for cleanup
      _created_at: new Date().toISOString(),
    };

    return await db.insert(doc);
  }

  async deleteDocument(username: string, docId: string): Promise<boolean> {
    try {
      const doc = await this.getDocument(username, docId);
      const dbName = this.getUserDbName(username);
      const db = this.couch.db.use(dbName);
      await db.destroy(docId, doc._rev);
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return false; // Document didn't exist
      }
      throw error;
    }
  }

  async cleanupTestDocuments(username: string): Promise<void> {
    const dbName = this.getUserDbName(username);

    try {
      const db = this.couch.db.use(dbName);

      // Find all test documents
      const result = await db.find({
        selector: {
          _test_document: true,
        },
      });

      // Delete them
      for (const doc of result.docs) {
        try {
          await db.destroy(doc._id, doc._rev);
        } catch (error: any) {
          if (error.statusCode !== 404) {
            console.warn(`Failed to cleanup test document ${doc._id}:`, error.message);
          }
        }
      }
    } catch (error: any) {
      if (error.statusCode === 404) {
        // Database doesn't exist, nothing to clean
        return;
      }
      throw error;
    }
  }

  async waitForDocumentToExist(
    username: string,
    docId: string,
    timeoutMs: number = 5000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (await this.documentExists(username, docId)) {
        return true;
      }
      await this.sleep(100);
    }

    return false;
  }

  async waitForDocumentToBeRemoved(
    username: string,
    docId: string,
    timeoutMs: number = 5000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (!(await this.documentExists(username, docId))) {
        return true;
      }
      await this.sleep(100);
    }

    return false;
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
