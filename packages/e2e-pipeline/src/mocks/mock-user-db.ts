/**
 * Mock UserDBInterface for testing SessionController and Pipeline.
 *
 * Provides controllable implementations of user database operations
 * for testing without real database access.
 */

// Standalone mock - does not implement the full UserDBInterface

/**
 * Card history record for tracking outcomes.
 */
export interface MockCardHistory {
  cardId: string;
  courseId: string;
  outcomes: Array<{
    timestamp: Date;
    correct: boolean;
    responseTime?: number;
  }>;
  nextReviewDate?: Date;
  interval?: number;
  easeFactor?: number;
}

/**
 * User course data.
 */
export interface MockUserCourseData {
  elo: number;
  cardHistory: Map<string, MockCardHistory>;
  scheduledReviews: string[];
  masteredTags: Set<string>;
}

/**
 * Configuration for MockUserDB.
 */
export interface MockUserDBConfig {
  userId?: string;
  defaultElo?: number;
  courseData?: Map<string, Partial<MockUserCourseData>>;
}

/**
 * Mock implementation of UserDBInterface for testing.
 *
 * Allows tests to control user state and track database operations.
 */
export class MockUserDB {
  private userId: string;
  private defaultElo: number;
  private courseData: Map<string, MockUserCourseData> = new Map();
  
  // Tracking
  private recordedOutcomes: Array<{
    courseId: string;
    cardId: string;
    outcome: unknown;
    timestamp: Date;
  }> = [];

  constructor(config: MockUserDBConfig = {}) {
    this.userId = config.userId ?? 'test-user';
    this.defaultElo = config.defaultElo ?? 1200;

    if (config.courseData) {
      for (const [courseId, data] of config.courseData) {
        this.initCourseData(courseId, data);
      }
    }
  }

  /**
   * Initialize or get course data.
   */
  private initCourseData(courseId: string, initial?: Partial<MockUserCourseData>): MockUserCourseData {
    if (!this.courseData.has(courseId)) {
      this.courseData.set(courseId, {
        elo: initial?.elo ?? this.defaultElo,
        cardHistory: initial?.cardHistory ?? new Map(),
        scheduledReviews: initial?.scheduledReviews ?? [],
        masteredTags: initial?.masteredTags ?? new Set(),
      });
    }
    return this.courseData.get(courseId)!;
  }

  /**
   * Get the user ID.
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Get user ELO for a course.
   */
  async getUserELO(courseId: string): Promise<number> {
    const data = this.initCourseData(courseId);
    return data.elo;
  }

  /**
   * Set user ELO for a course.
   */
  async setUserELO(courseId: string, elo: number): Promise<void> {
    const data = this.initCourseData(courseId);
    data.elo = elo;
  }

  /**
   * Get card history.
   */
  async getCardHistory(courseId: string, cardId: string): Promise<MockCardHistory | null> {
    const data = this.initCourseData(courseId);
    return data.cardHistory.get(cardId) ?? null;
  }

  /**
   * Record a card outcome.
   */
  async recordCardOutcome(
    courseId: string,
    cardId: string,
    outcome: { correct: boolean; responseTime?: number }
  ): Promise<void> {
    const data = this.initCourseData(courseId);
    
    let history = data.cardHistory.get(cardId);
    if (!history) {
      history = {
        cardId,
        courseId,
        outcomes: [],
      };
      data.cardHistory.set(cardId, history);
    }

    history.outcomes.push({
      timestamp: new Date(),
      correct: outcome.correct,
      responseTime: outcome.responseTime,
    });

    // Track for test inspection
    this.recordedOutcomes.push({
      courseId,
      cardId,
      outcome,
      timestamp: new Date(),
    });
  }

  /**
   * Get all card records for a course.
   */
  async getCardRecords(courseId: string): Promise<MockCardHistory[]> {
    const data = this.initCourseData(courseId);
    return Array.from(data.cardHistory.values());
  }

  /**
   * Get scheduled reviews for a course.
   */
  async getScheduledReviews(courseId: string): Promise<string[]> {
    const data = this.initCourseData(courseId);
    return data.scheduledReviews;
  }

  /**
   * Schedule a card for review.
   */
  async scheduleReview(courseId: string, cardId: string, date?: Date): Promise<void> {
    const data = this.initCourseData(courseId);
    if (!data.scheduledReviews.includes(cardId)) {
      data.scheduledReviews.push(cardId);
    }
    
    const history = data.cardHistory.get(cardId);
    if (history) {
      history.nextReviewDate = date ?? new Date();
    }
  }

  /**
   * Remove a card from scheduled reviews.
   */
  async unscheduleReview(courseId: string, cardId: string): Promise<void> {
    const data = this.initCourseData(courseId);
    data.scheduledReviews = data.scheduledReviews.filter((id) => id !== cardId);
  }

  // ============================================================================
  // TEST HELPER METHODS
  // ============================================================================

  /**
   * Set ELO directly (convenience method for tests).
   */
  setElo(courseId: string, elo: number): void {
    const data = this.initCourseData(courseId);
    data.elo = elo;
  }

  /**
   * Mark a tag as mastered for a course.
   */
  setTagMastered(courseId: string, tag: string): void {
    const data = this.initCourseData(courseId);
    data.masteredTags.add(tag);
  }

  /**
   * Check if a tag is mastered.
   */
  isTagMastered(courseId: string, tag: string): boolean {
    const data = this.courseData.get(courseId);
    return data?.masteredTags.has(tag) ?? false;
  }

  /**
   * Get all recorded outcomes for inspection.
   */
  getRecordedOutcomes(): typeof this.recordedOutcomes {
    return [...this.recordedOutcomes];
  }

  /**
   * Get recorded outcomes for a specific card.
   */
  getCardOutcomes(cardId: string): typeof this.recordedOutcomes {
    return this.recordedOutcomes.filter((o) => o.cardId === cardId);
  }

  /**
   * Clear recorded outcomes.
   */
  clearRecordedOutcomes(): void {
    this.recordedOutcomes = [];
  }

  /**
   * Simulate mastery of cards with a specific tag.
   * Sets high success rate in card history.
   */
  simulateTagMastery(
    courseId: string,
    tag: string,
    cardIds: string[],
    masteryRate = 0.9
  ): void {
    const data = this.initCourseData(courseId);
    
    for (const cardId of cardIds) {
      const outcomes: MockCardHistory['outcomes'] = [];
      const totalAttempts = 10;
      const successCount = Math.floor(totalAttempts * masteryRate);

      for (let i = 0; i < totalAttempts; i++) {
        outcomes.push({
          timestamp: new Date(Date.now() - (totalAttempts - i) * 3600000),
          correct: i < successCount,
        });
      }

      data.cardHistory.set(cardId, {
        cardId,
        courseId,
        outcomes,
      });
    }

    if (masteryRate >= 0.8) {
      data.masteredTags.add(tag);
    }
  }

  /**
   * Get mastery rate for a card based on history.
   */
  getCardMasteryRate(courseId: string, cardId: string): number {
    const data = this.courseData.get(courseId);
    const history = data?.cardHistory.get(cardId);
    
    if (!history || history.outcomes.length === 0) {
      return 0;
    }

    const correctCount = history.outcomes.filter((o) => o.correct).length;
    return correctCount / history.outcomes.length;
  }

  /**
   * Reset all data.
   */
  reset(): void {
    this.courseData.clear();
    this.recordedOutcomes = [];
  }
}

/**
 * Create a MockUserDB with default configuration.
 */
export function createMockUserDB(config?: MockUserDBConfig): MockUserDB {
  return new MockUserDB(config);
}

/**
 * Create a MockUserDB with a specific ELO for a course.
 */
export function createMockUserDBWithElo(
  courseId: string,
  elo: number,
  userId = 'test-user'
): MockUserDB {
  const db = new MockUserDB({ userId });
  db.setElo(courseId, elo);
  return db;
}

/**
 * Create a MockUserDB with simulated mastery.
 */
export function createMockUserDBWithMastery(
  courseId: string,
  masteredTags: string[],
  userId = 'test-user'
): MockUserDB {
  const db = new MockUserDB({ userId });
  for (const tag of masteredTags) {
    db.setTagMastered(courseId, tag);
  }
  return db;
}