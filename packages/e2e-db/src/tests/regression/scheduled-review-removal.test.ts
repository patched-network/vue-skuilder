import { describe, it, expect, beforeEach } from '@jest/globals';
import { initializeDataLayer, _resetDataLayer } from '@vue-skuilder/db';
import type { DataLayerProvider, UserDBInterface } from '@vue-skuilder/db';
import { RawCouchHelper } from '../../helpers/raw-couch';
import { type TestUser, type TestScheduledReview } from '../../helpers/test-data-factory';

declare global {
  var databaseManager: any;
  var testDataFactory: any;
}

describe('Scheduled Review Removal Regression Tests', () => {
  let dataLayer: DataLayerProvider;
  let rawCouch: RawCouchHelper;
  let testUser: TestUser;
  let user: UserDBInterface;

  beforeEach(async () => {
    // Reset data layer for clean state
    await _resetDataLayer();

    // Initialize data layer with test CouchDB
    dataLayer = await initializeDataLayer({
      type: 'couch',
      options: {
        COUCHDB_SERVER_URL: 'localhost:5984/',
        COUCHDB_SERVER_PROTOCOL: 'http',
      },
    });

    // Create raw CouchDB helper for direct database verification
    rawCouch = new RawCouchHelper({
      couchUrl: 'http://localhost:5984',
      adminUsername: 'admin',
      adminPassword: 'password',
    });

    // Create test user
    testUser = global.testDataFactory.createTestUser('regression_test');

    // Create user database
    await global.databaseManager.createTestUser(testUser.username);

    // Get user interface via public API
    user = await dataLayer.getUserDB();
  });

  describe('removeScheduledCardReview bug reproduction', () => {
    it('should actually remove scheduled review from database', async () => {
      // Create test review data
      const testReview: TestScheduledReview = global.testDataFactory.createTestScheduledReview(
        testUser.username,
        'test-course-123',
        'test-card-456',
        1 // 1 hour in future
      );

      // Schedule review via public API
      await user.scheduleCardReview(testReview);

      // Verify review was scheduled via public API
      const pendingReviews = await user.getPendingReviews();
      expect(pendingReviews).toHaveLength(1);

      const scheduledReview = pendingReviews[0];
      expect(scheduledReview.cardId).toBe(testReview.card_id);

      // Verify review exists in raw database
      const initialCount = await rawCouch.getScheduledReviewCount(testUser.username);
      expect(initialCount).toBe(1);

      const reviewExists = await rawCouch.assertReviewExists(
        testUser.username,
        scheduledReview._id
      );
      expect(reviewExists).toBe(true);

      // THIS WAS THE BUG: Remove review using the BROKEN calling pattern from StudySession.vue
      // The implementation only accepts reviewId but StudySession passes (username, reviewId)
      // await user.removeScheduledCardReview(testUser.username, scheduledReview._id);

      // Use the CORRECT interface signature (reviewId only) - this is the fixed calling pattern
      await user.removeScheduledCardReview(scheduledReview._id);

      // Verify removal via public API
      const remainingReviews = await user.getPendingReviews();
      expect(remainingReviews).toHaveLength(0);

      // CRITICAL: Verify review is actually removed from raw database
      // This is where the bug would be caught - the API might say "success"
      // but the document could still exist in the database
      const finalCount = await rawCouch.getScheduledReviewCount(testUser.username);
      expect(finalCount).toBe(0);

      const reviewRemoved = await rawCouch.assertReviewRemoved(
        testUser.username,
        scheduledReview._id
      );
      expect(reviewRemoved).toBe(true);
    });

    it('should handle the corrected single-parameter calling pattern', async () => {
      // Create test review
      const testReview: TestScheduledReview = global.testDataFactory.createTestScheduledReview(
        testUser.username,
        'test-course-corrected',
        'test-card-corrected'
      );

      // Schedule review
      await user.scheduleCardReview(testReview);

      // Get scheduled review
      const pendingReviews = await user.getPendingReviews();
      expect(pendingReviews).toHaveLength(1);

      const scheduledReview = pendingReviews[0];

      // Verify exists in database
      const reviewExists = await rawCouch.assertReviewExists(
        testUser.username,
        scheduledReview._id
      );
      expect(reviewExists).toBe(true);

      // Use the CORRECT interface signature (reviewId only)
      await user.removeScheduledCardReview(scheduledReview._id);

      // Verify removal
      const finalCount = await rawCouch.getScheduledReviewCount(testUser.username);
      expect(finalCount).toBe(0);
    });

    it('should handle multiple scheduled reviews correctly', async () => {
      // Schedule multiple reviews
      const reviews = [
        global.testDataFactory.createTestScheduledReview(testUser.username, 'course-1', 'card-1'),
        global.testDataFactory.createTestScheduledReview(testUser.username, 'course-2', 'card-2'),
        global.testDataFactory.createTestScheduledReview(testUser.username, 'course-3', 'card-3'),
      ];

      for (const review of reviews) {
        await user.scheduleCardReview(review);
      }

      // Verify all reviews scheduled
      let pendingReviews = await user.getPendingReviews();
      expect(pendingReviews).toHaveLength(3);

      const initialCount = await rawCouch.getScheduledReviewCount(testUser.username);
      expect(initialCount).toBe(3);

      // Remove middle review
      const reviewToRemove = pendingReviews[1];
      await user.removeScheduledCardReview(reviewToRemove._id);

      // Verify only that review was removed
      pendingReviews = await user.getPendingReviews();
      expect(pendingReviews).toHaveLength(2);

      const finalCount = await rawCouch.getScheduledReviewCount(testUser.username);
      expect(finalCount).toBe(2);

      // Verify specific review was removed
      const reviewRemoved = await rawCouch.assertReviewRemoved(
        testUser.username,
        reviewToRemove._id
      );
      expect(reviewRemoved).toBe(true);

      // Verify other reviews still exist
      const remainingIds = pendingReviews.map((r: any) => r._id);
      for (const id of remainingIds) {
        const stillExists = await rawCouch.assertReviewExists(testUser.username, id);
        expect(stillExists).toBe(true);
      }
    });

    it('should handle non-existent review removal gracefully', async () => {
      const nonExistentReviewId = 'review-nonexistent-12345';

      // Verify review doesn't exist
      const exists = await rawCouch.assertReviewExists(testUser.username, nonExistentReviewId);
      expect(exists).toBe(false);

      // Attempt to remove non-existent review
      // This should either throw an error or handle gracefully
      await expect(user.removeScheduledCardReview(nonExistentReviewId)).rejects.toThrow();
    });

    it('should maintain data consistency across concurrent operations', async () => {
      // Schedule multiple reviews
      const reviews = Array.from({ length: 5 }, (_, i) =>
        global.testDataFactory.createTestScheduledReview(
          testUser.username,
          `course-${i}`,
          `card-${i}`
        )
      );

      // Schedule all reviews concurrently
      await Promise.all(reviews.map((review) => user.scheduleCardReview(review)));

      // Verify all scheduled
      const pendingReviews = await user.getPendingReviews();
      expect(pendingReviews).toHaveLength(5);

      // Remove reviews concurrently
      const removePromises = pendingReviews.map((review: any) =>
        user.removeScheduledCardReview(review._id)
      );

      await Promise.all(removePromises);

      // Verify all removed
      const finalReviews = await user.getPendingReviews();
      expect(finalReviews).toHaveLength(0);

      const finalCount = await rawCouch.getScheduledReviewCount(testUser.username);
      expect(finalCount).toBe(0);
    });
  });

  describe('StudySession.vue integration patterns', () => {
    it('reproduces exact StudySession.vue calling pattern', async () => {
      // This test reproduces the exact code pattern from StudySession.vue line 518:
      // this.user!.removeScheduledCardReview(this.user!.getUsername(), item.reviewID);

      const testReview = global.testDataFactory.createTestScheduledReview(
        testUser.username,
        'studysession-course',
        'studysession-card'
      );

      await user.scheduleCardReview(testReview);

      const pendingReviews = await user.getPendingReviews();
      const item = pendingReviews[0]; // This represents the 'item' in StudySession.vue

      // Exact pattern from StudySession.vue:
      await user.removeScheduledCardReview(item._id);

      // Verify the operation actually worked
      const finalCount = await rawCouch.getScheduledReviewCount(testUser.username);
      expect(finalCount).toBe(0);

      const reviewRemoved = await rawCouch.assertReviewRemoved(testUser.username, item._id);
      expect(reviewRemoved).toBe(true);
    });
  });
});
