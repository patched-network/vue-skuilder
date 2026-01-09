/**
 * Mock implementations for e2e-pipeline tests.
 *
 * Provides controllable mock implementations of core interfaces
 * for testing session and pipeline behavior.
 */

// Mock StudyContentSource
export {
  MockStudyContentSource,
  MockSourceConfig,
  SimpleCard,
  createWeightedCard,
  createWeightedCards,
  createMockSource,
  createEmptyMockSource,
  createGradedMockSource,
  createReviewMockSource,
} from './mock-source';

// Mock UserDBInterface
export {
  MockUserDB,
  MockUserDBConfig,
  MockCardHistory,
  MockUserCourseData,
  createMockUserDB,
  createMockUserDBWithElo,
  createMockUserDBWithMastery,
} from './mock-user-db';