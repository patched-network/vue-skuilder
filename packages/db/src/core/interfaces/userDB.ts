import {
  ActivityRecord,
  CourseRegistration,
  CourseRegistrationDoc,
  ScheduledCard,
} from '@db/core/types/user';
import { CourseElo, Status } from '@vue-skuilder/common';
import { Moment } from 'moment';
import { CardHistory, CardRecord, QualifiedCardID } from '../types/types-legacy';
import { UserOutcomeRecord } from '../types/userOutcome';
import { UserConfig } from '../types/user';
import { DocumentUpdater } from '@db/study';

/**
 * Read-only user data operations
 */
export interface UserDBReader {
  get<T>(id: string): Promise<T & PouchDB.Core.RevisionIdMeta>;
  getUsername(): string;
  isLoggedIn(): boolean;

  /**
   * Get user configuration
   */
  getConfig(): Promise<UserConfig>;

  /**
   * Get cards that the user has seen
   */
  getSeenCards(courseId?: string): Promise<string[]>;

  /**
   * Get cards that are actively scheduled for review
   */
  getActiveCards(): Promise<QualifiedCardID[]>;

  /**
   * Get user's course registrations
   */
  getCourseRegistrationsDoc(): Promise<CourseRegistrationDoc>;

  /**
   * Get the registration doc for a specific course.
   * @param courseId
   */
  getCourseRegDoc(courseId: string): Promise<CourseRegistration>;

  /**
   * Get user's active courses
   */
  getActiveCourses(): Promise<CourseRegistration[]>;

  /**
   * Get user's pending reviews
   */
  getPendingReviews(courseId?: string): Promise<ScheduledCard[]>;

  getActivityRecords(): Promise<ActivityRecord[]>;

  /**
   * Get strategy-specific state for a course.
   *
   * Strategies use this to persist preferences, learned patterns, or temporal
   * tracking data across sessions. Each strategy owns its own namespace.
   *
   * @deprecated Use `getCourseInterface(courseId).getStrategyState(strategyKey)` instead.
   * Direct use bypasses course-scoping safety — the courseId parameter is unguarded,
   * allowing accidental cross-course data access. The course-scoped interface binds
   * courseId once at construction.
   *
   * @param courseId - The course this state applies to
   * @param strategyKey - Unique key identifying the strategy (typically class name)
   * @returns The strategy's data payload, or null if no state exists
   */
  getStrategyState<T>(courseId: string, strategyKey: string): Promise<T | null>;

  /**
   * Get user's classroom registrations
   */
  getUserClassrooms(): Promise<ClassroomRegistrationDoc>;

  /**
   * Get user's active classes
   */
  getActiveClasses(): Promise<string[]>;

  getCourseInterface(courseId: string): Promise<UsrCrsDataInterface>;
}

/**
 * User data mutation operations
 */
export interface UserDBWriter extends DocumentUpdater {
  /**
   * Update user configuration
   */
  setConfig(config: Partial<UserConfig>): Promise<void>;

  /**
   * Record a user's interaction with a card
   */
  putCardRecord<T extends CardRecord>(record: T): Promise<CardHistory<CardRecord>>;

  /**
   * Register user for a course
   */
  registerForCourse(courseId: string, previewMode?: boolean): Promise<PouchDB.Core.Response>;

  /**
   * Drop a course registration
   */
  dropCourse(courseId: string, dropStatus?: string): Promise<PouchDB.Core.Response>;

  /**
   * Schedule a card for review
   */
  scheduleCardReview(review: {
    user: string;
    course_id: string;
    card_id: string;
    time: Moment;
    scheduledFor: 'course' | 'classroom';
    schedulingAgentId: string;
  }): Promise<void>;

  /**
   * Remove a scheduled card review
   */
  removeScheduledCardReview(reviewId: string): Promise<void>;

  /**
   * Register user for a classroom
   */
  registerForClassroom(
    classId: string,
    registerAs: 'student' | 'teacher' | 'aide' | 'admin'
  ): Promise<PouchDB.Core.Response>;

  /**
   * Drop user from classroom
   */
  dropFromClassroom(classId: string): Promise<PouchDB.Core.Response>;

  /**
   * Update user's ELO rating for a course
   */
  updateUserElo(courseId: string, elo: CourseElo): Promise<PouchDB.Core.Response>;

  /**
   * Reset all user data (progress, registrations, etc.) while preserving authentication
   */
  resetUserData(): Promise<{ status: Status; error?: string }>;

  /**
   * Store strategy-specific state for a course.
   *
   * Strategies use this to persist preferences, learned patterns, or temporal
   * tracking data across sessions. Each strategy owns its own namespace.
   *
   * @deprecated Use `getCourseInterface(courseId).putStrategyState(strategyKey, data)` instead.
   * Direct use bypasses course-scoping safety — the courseId parameter is unguarded,
   * allowing accidental cross-course data writes. The course-scoped interface binds
   * courseId once at construction.
   *
   * @param courseId - The course this state applies to
   * @param strategyKey - Unique key identifying the strategy (typically class name)
   * @param data - The strategy's data payload to store
   */
  putStrategyState<T>(courseId: string, strategyKey: string, data: T): Promise<void>;

  /**
   * Delete strategy-specific state for a course.
   *
   * @deprecated Use `getCourseInterface(courseId).deleteStrategyState(strategyKey)` instead.
   * Direct use bypasses course-scoping safety.
   *
   * @param courseId - The course this state applies to
   * @param strategyKey - Unique key identifying the strategy (typically class name)
   */
  deleteStrategyState(courseId: string, strategyKey: string): Promise<void>;

  /**
   * Record a user learning outcome for evolutionary orchestration.
   */
  putUserOutcome(record: UserOutcomeRecord): Promise<void>;
}

/**
 * Authentication and account management operations
 */
export interface UserDBAuthenticator {
  /**
   * Create a new user account
   */
  createAccount(
    username: string,
    password: string
  ): Promise<{
    status: Status;
    error: string;
  }>;

  /**
   * Log in as a user
   */
  login(
    username: string,
    password: string
  ): Promise<{
    ok: boolean;
    name?: string;
    roles?: string[];
  }>;

  /**
   * Log out the current user
   */
  logout(): Promise<{
    ok: boolean;
  }>;
}

/**
 * Complete user database interface - combines all user operations
 * This maintains backward compatibility with existing code
 */
export interface UserDBInterface extends UserDBReader, UserDBWriter, UserDBAuthenticator {}

export interface UserCourseSettings {
  [setting: string]: string | number | boolean;
}

export interface UserCourseSetting {
  key: string;
  value: string | number | boolean;
}

// [ ] reconsider here. Should maybe be generic type based on <T extends StudyContentSource> ?
export interface UsrCrsDataInterface {
  getScheduledReviewCount(): Promise<number>;
  getCourseSettings(): Promise<UserCourseSettings>;
  updateCourseSettings(updates: UserCourseSetting[]): void; // [ ] return a result of some sort?
  // getRegistrationDoc(): Promise<CourseRegistration>;

  /**
   * Get strategy-specific state for this course.
   *
   * Course-scoped alternative to `UserDBInterface.getStrategyState()`.
   * The courseId is bound at construction via `getCourseInterface(courseId)`,
   * so callers cannot accidentally access another course's state.
   *
   * @param strategyKey - Unique key identifying the state document
   * @returns The state payload, or null if no state exists
   */
  getStrategyState<T>(strategyKey: string): Promise<T | null>;

  /**
   * Store strategy-specific state for this course.
   *
   * Course-scoped alternative to `UserDBInterface.putStrategyState()`.
   *
   * @param strategyKey - Unique key identifying the state document
   * @param data - The state payload to store
   */
  putStrategyState<T>(strategyKey: string, data: T): Promise<void>;

  /**
   * Delete strategy-specific state for this course.
   *
   * Course-scoped alternative to `UserDBInterface.deleteStrategyState()`.
   *
   * @param strategyKey - Unique key identifying the state document
   */
  deleteStrategyState(strategyKey: string): Promise<void>;
}

export type ClassroomRegistrationDesignation = 'student' | 'teacher' | 'aide' | 'admin';

export interface ClassroomRegistration {
  classID: string;
  registeredAs: ClassroomRegistrationDesignation;
}

export interface ClassroomRegistrationDoc {
  registrations: ClassroomRegistration[];
}
