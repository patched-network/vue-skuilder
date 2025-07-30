import {
  ActivityRecord,
  CourseRegistration,
  CourseRegistrationDoc,
  ScheduledCard,
} from '@db/core/types/user';
import { CourseElo, Status } from '@vue-skuilder/common';
import { Moment } from 'moment';
import { CardHistory, CardRecord } from '../types/types-legacy';
import { UserConfig } from '../types/user';
import { DocumentUpdater } from '@db/study';

/**
 * Read-only user data operations
 */
export interface UserDBReader extends DocumentUpdater {
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
  getActiveCards(): Promise<string[]>;
  
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
export interface UserDBWriter {
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
export interface UserDBInterface extends UserDBReader, UserDBWriter, UserDBAuthenticator {
}

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
}

export type ClassroomRegistrationDesignation = 'student' | 'teacher' | 'aide' | 'admin';

export interface ClassroomRegistration {
  classID: string;
  registeredAs: ClassroomRegistrationDesignation;
}

export interface ClassroomRegistrationDoc {
  registrations: ClassroomRegistration[];
}
