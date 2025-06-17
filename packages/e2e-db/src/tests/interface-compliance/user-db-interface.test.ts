import { describe, it, expect, beforeEach } from '@jest/globals';
import { _resetDataLayer } from '@vue-skuilder/db';
import type { DataLayerProvider } from '@vue-skuilder/db';
import { RawCouchHelper } from '../../helpers/raw-couch';
import { TestUtils, type UserTestContext } from '../../helpers/test-utils';

declare global {
  var databaseManager: any;
  var testDataFactory: any;
}

describe('UserDB Interface Compliance', () => {
  let dataLayer: DataLayerProvider;
  let rawCouch: RawCouchHelper;
  let userContext: UserTestContext;

  beforeEach(async () => {
    const env = await TestUtils.initializeTestEnvironment();
    dataLayer = env.dataLayer;
    rawCouch = env.rawCouch;

    userContext = await TestUtils.createUserTestContext(dataLayer, rawCouch, 'interface_test');
  });

  describe('User Creation and Authentication', () => {
    it('should create user account via public API', async () => {
      const newUser = global.testDataFactory.createTestUser('new_user');

      // Create account via public API
      const result = await userContext.user.createAccount(newUser.username, newUser.password);

      // Verify account creation response
      expect(result.status).toBeDefined();
      expect(result.error).toBeDefined();

      // Verify user database exists in CouchDB
      const dbExists = await rawCouch.databaseExists(newUser.username);
      expect(dbExists).toBe(true);
    });

    it('should handle login via public API', async () => {
      const testUser = global.testDataFactory.createTestUser('login_test');

      // Create account first
      await userContext.user.createAccount(testUser.username, testUser.password);

      // Login via public API
      const loginResult = await userContext.user.login(testUser.username, testUser.password);

      // Verify login response
      expect(loginResult.ok).toBeDefined();
      if (loginResult.ok) {
        expect(loginResult.name).toBe(testUser.username);
        expect(loginResult.roles).toBeDefined();
      }
    });

    it('should track logged in state', async () => {
      // Before login
      expect(userContext.user.isLoggedIn()).toBe(false);

      // Create and login
      const testUser = global.testDataFactory.createTestUser('state_test');
      await userContext.user.createAccount(testUser.username, testUser.password);
      await userContext.user.login(testUser.username, testUser.password);

      // After login
      expect(userContext.user.isLoggedIn()).toBe(true);
      expect(userContext.user.getUsername()).toBe(testUser.username);

      // After logout
      await userContext.user.logout();
      expect(userContext.user.isLoggedIn()).toBe(false);
    });
  });

  describe('Configuration Management', () => {
    it('should handle user configuration via public API', async () => {
      const config = TestUtils.createMockUserConfig();

      // Set config via public API
      await userContext.user.setConfig(config);

      // Get config via public API
      const retrievedConfig = await userContext.user.getConfig();
      expect(retrievedConfig).toMatchObject(config);

      // Verify config persisted to database
      const rawConfig = await rawCouch.getUserConfig(userContext.testUser.username);
      expect(rawConfig).toBeDefined();
      expect(rawConfig.darkMode).toBe(config.darkMode);
    });

    it('should handle partial config updates', async () => {
      const initialConfig = TestUtils.createMockUserConfig();
      await userContext.user.setConfig(initialConfig);

      // Partial update
      const update = { darkMode: true };
      await userContext.user.setConfig(update);

      // Verify update
      const finalConfig = await userContext.user.getConfig();
      expect(finalConfig.darkMode).toBe(true);
      // likesConfetti should still be true (partial update)
      expect(finalConfig.likesConfetti).toBe(true);
    });
  });

  describe('Course Management', () => {
    it('should handle course registration via public API', async () => {
      const testCourse = global.testDataFactory.createTestCourse('interface_course');

      // Register for course
      const result = await userContext.user.registerForCourse(testCourse.courseId);
      expect(result.ok).toBeTruthy();

      // Verify registration via public API
      const registrations = await userContext.user.getActiveCourses();
      expect(registrations).toHaveLength(1);
      expect(registrations[0].courseID).toBe(testCourse.courseId);

      // Verify registration in raw database
      const rawRegistrations = await rawCouch.getUserRegistrations(userContext.testUser.username);
      expect(rawRegistrations).toContain(testCourse.courseId);
    });

    it('should handle course dropping', async () => {
      const testCourse = global.testDataFactory.createTestCourse('drop_course');

      // Register first
      await userContext.user.registerForCourse(testCourse.courseId);

      // Verify registration
      let registrations = await userContext.user.getActiveCourses();
      expect(registrations).toHaveLength(1);

      // Drop course
      const dropResult = await userContext.user.dropCourse(testCourse.courseId);
      expect(dropResult.ok).toBeTruthy();

      // Verify course dropped
      registrations = await userContext.user.getActiveCourses();
      expect(registrations).toHaveLength(0);
    });
  });

  describe('Card Operations', () => {
    it('should handle card record storage', async () => {
      const cardRecord = TestUtils.createMockCardRecord('test-card-123', 'test-course-123');

      // Store card record via public API
      const result = await userContext.user.putCardRecord(cardRecord);
      expect(result).toBeDefined();

      // Verify card appears in seen cards
      const seenCards = await userContext.user.getSeenCards();
      expect(seenCards.length).toBeGreaterThan(0);

      // Verify card history exists in raw database
      const cardHistory = await rawCouch.getCardHistory(
        userContext.testUser.username,
        cardRecord.cardId
      );
      expect(cardHistory.length).toBeGreaterThan(0);
    });

    it('should track active cards correctly', async () => {
      const testReview = global.testDataFactory.createTestScheduledReview(
        userContext.testUser.username,
        'active-course',
        'active-card'
      );

      // Schedule a review
      await userContext.user.scheduleCardReview(testReview);

      // Verify card appears in active cards
      const activeCards = await userContext.user.getActiveCards();
      expect(activeCards).toContain(`${testReview.course_id}-${testReview.card_id}`);
    });
  });

  describe('Review Management', () => {
    it('should handle review scheduling via public API', async () => {
      const testReview = global.testDataFactory.createTestScheduledReview(
        userContext.testUser.username,
        'schedule-course',
        'schedule-card',
        2 // 2 hours in future
      );

      // Schedule review via public API
      await userContext.user.scheduleCardReview(testReview);

      // Verify scheduling via public API
      const pendingReviews = await userContext.user.getPendingReviews();
      expect(pendingReviews).toHaveLength(1);

      TestUtils.assertValidScheduledReview(pendingReviews[0]);
      expect(pendingReviews[0].cardId).toBe(testReview.card_id);

      // Verify scheduling in raw database
      const rawReviews = await rawCouch.getScheduledReviews(userContext.testUser.username);
      expect(rawReviews).toHaveLength(1);
      expect(rawReviews[0].cardId).toBe(testReview.card_id);
    });

    it('should filter pending reviews by course', async () => {
      const course1Review = global.testDataFactory.createTestScheduledReview(
        userContext.testUser.username,
        'course-1',
        'card-1'
      );
      const course2Review = global.testDataFactory.createTestScheduledReview(
        userContext.testUser.username,
        'course-2',
        'card-2'
      );

      // Schedule both reviews
      await userContext.user.scheduleCardReview(course1Review);
      await userContext.user.scheduleCardReview(course2Review);

      // Get all pending reviews
      const allReviews = await userContext.user.getPendingReviews();
      expect(allReviews).toHaveLength(2);

      // Get course-specific reviews
      const course1Reviews = await userContext.user.getPendingReviews('course-1');
      expect(course1Reviews).toHaveLength(1);
      expect(course1Reviews[0].courseId).toBe('course-1');
    });

    it('should comply with removeScheduledCardReview interface', async () => {
      const testReview = global.testDataFactory.createTestScheduledReview(
        userContext.testUser.username,
        'remove-course',
        'remove-card'
      );

      // Schedule review
      await userContext.user.scheduleCardReview(testReview);

      // Get scheduled review
      const pendingReviews = await userContext.user.getPendingReviews();
      expect(pendingReviews).toHaveLength(1);
      const reviewToRemove = pendingReviews[0];

      // Remove using interface-compliant call (reviewId only)
      await userContext.user.removeScheduledCardReview(reviewToRemove._id);

      // Verify removal via public API
      const remainingReviews = await userContext.user.getPendingReviews();
      expect(remainingReviews).toHaveLength(0);

      // Verify removal in raw database
      const reviewRemoved = await rawCouch.assertReviewRemoved(
        userContext.testUser.username,
        reviewToRemove._id
      );
      expect(reviewRemoved).toBe(true);
    });
  });

  describe('Activity Tracking', () => {
    it('should track activity records', async () => {
      // Create some activity
      const cardRecord = TestUtils.createMockCardRecord('activity-card', 'activity-course');
      await userContext.user.putCardRecord(cardRecord);

      // Get activity records
      const activityRecords = await userContext.user.getActivityRecords();
      expect(activityRecords).toBeDefined();
      expect(Array.isArray(activityRecords)).toBe(true);

      // Verify activity persisted to database
      const rawActivity = await rawCouch.getActivityRecords(userContext.testUser.username);
      expect(rawActivity).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid course registration gracefully', async () => {
      await expect(
        userContext.user.registerForCourse('non-existent-course-12345')
      ).rejects.toThrow();
    });

    it('should handle invalid review removal gracefully', async () => {
      await expect(
        userContext.user.removeScheduledCardReview('non-existent-review-12345')
      ).rejects.toThrow();
    });

    it('should handle malformed configuration gracefully', async () => {
      // This should either work or throw a meaningful error
      try {
        await userContext.user.setConfig({ invalidKey: 'invalidValue' } as any);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
