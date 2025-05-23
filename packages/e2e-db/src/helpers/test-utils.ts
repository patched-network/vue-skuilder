import { DataLayerProvider, UserDBInterface } from '@vue-skuilder/db';
import { initializeDataLayer, _resetDataLayer } from '@vue-skuilder/db';
import { RawCouchHelper } from './raw-couch';
import { TestDataFactory, TestUser } from './test-data-factory';

export interface TestEnvironment {
  dataLayer: DataLayerProvider;
  rawCouch: RawCouchHelper;
  testDataFactory: TestDataFactory;
  databaseManager: any;
}

export interface UserTestContext {
  user: UserDBInterface;
  testUser: TestUser;
  rawCouch: RawCouchHelper;
}

export class TestUtils {
  static async initializeTestEnvironment(): Promise<TestEnvironment> {
    await _resetDataLayer();
    
    const dataLayer = await initializeDataLayer({
      type: 'pouch',
      options: {
        COUCHDB_SERVER_URL: 'localhost:5984/',
        COUCHDB_SERVER_PROTOCOL: 'http'
      }
    });

    const rawCouch = new RawCouchHelper({
      couchUrl: 'http://localhost:5984',
      adminUsername: 'admin',
      adminPassword: 'password'
    });

    return {
      dataLayer,
      rawCouch,
      testDataFactory: global.testDataFactory,
      databaseManager: global.databaseManager
    };
  }

  static async createUserTestContext(
    dataLayer: DataLayerProvider,
    rawCouch: RawCouchHelper,
    usernamePrefix: string = 'testuser'
  ): Promise<UserTestContext> {
    const testUser = global.testDataFactory.createTestUser(usernamePrefix);
    
    // Create user database
    await global.databaseManager.createTestUser(testUser.username);
    
    // Get user interface via public API
    const user = await dataLayer.getUserDB();

    return {
      user,
      testUser,
      rawCouch
    };
  }

  static async waitForCondition(
    condition: () => Promise<boolean>,
    timeoutMs: number = 5000,
    intervalMs: number = 100
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (await condition()) {
        return true;
      }
      await this.sleep(intervalMs);
    }
    
    return false;
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static generateUniqueId(prefix: string = 'test'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static createMockCardRecord(cardId: string, courseId: string): any {
    return {
      cardId,
      courseId,
      timestamp: new Date().toISOString(),
      response: 'correct',
      timeToAnswer: 1500,
      difficulty: 0.5
    };
  }

  static createMockUserConfig(): any {
    return {
      darkMode: false,
      likesConfetti: true
    };
  }

  static assertValidScheduledReview(review: any): void {
    expect(review).toHaveProperty('_id');
    expect(review).toHaveProperty('cardId');
    expect(review).toHaveProperty('reviewTime');
    expect(review).toHaveProperty('courseId');
    expect(review).toHaveProperty('scheduledAt');
    expect(review).toHaveProperty('scheduledFor');
    expect(review).toHaveProperty('schedulingAgentId');
  }

  static assertValidUserRegistration(registration: any): void {
    expect(registration).toHaveProperty('courseId');
    expect(registration).toHaveProperty('registeredAt');
    expect(registration).toHaveProperty('status');
  }

  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        console.warn(`Operation failed (attempt ${attempt}/${maxRetries}):`, error);
        await this.sleep(delayMs);
      }
    }
    
    throw lastError!;
  }
}

// Global test assertions
export const customMatchers = {
  toExistInDatabase: async (received: { username: string; documentId: string }) => {
    const rawCouch = new RawCouchHelper({ 
      couchUrl: 'http://localhost:5984',
      adminUsername: 'admin',
      adminPassword: 'password'
    });
    const exists = await rawCouch.documentExists(received.username, received.documentId);
    
    return {
      message: () => `Expected document ${received.documentId} to exist in database for user ${received.username}`,
      pass: exists
    };
  },

  toBeRemovedFromDatabase: async (received: { username: string; documentId: string }) => {
    const rawCouch = new RawCouchHelper({ 
      couchUrl: 'http://localhost:5984',
      adminUsername: 'admin',
      adminPassword: 'password'
    });
    const exists = await rawCouch.documentExists(received.username, received.documentId);
    
    return {
      message: () => `Expected document ${received.documentId} to be removed from database for user ${received.username}`,
      pass: !exists
    };
  },

  toHaveScheduledReviewCount: async (received: string, expectedCount: number) => {
    const rawCouch = new RawCouchHelper({ 
      couchUrl: 'http://localhost:5984',
      adminUsername: 'admin',
      adminPassword: 'password'
    });
    const actualCount = await rawCouch.getScheduledReviewCount(received);
    
    return {
      message: () => `Expected user ${received} to have ${expectedCount} scheduled reviews, but found ${actualCount}`,
      pass: actualCount === expectedCount
    };
  }
};

// Type extensions for Jest
declare global {
  namespace jest {
    interface Matchers<R> {
      toExistInDatabase(): Promise<R>;
      toBeRemovedFromDatabase(): Promise<R>;
      toHaveScheduledReviewCount(expectedCount: number): Promise<R>;
    }
  }
}