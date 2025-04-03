import {
  ActivityRecord,
  CourseRegistration,
  CourseRegistrationDoc,
  ScheduledCard,
} from '@/core/types/user';
import { ClassroomRegistrationDoc } from '@/impl/pouch/userDB';
import { CourseElo, Status } from '@vue-skuilder/common';
import { Moment } from 'moment';
import { CardHistory, CardRecord } from '../types/types-legacy';
import { UserConfig } from '../types/user';
import { DocumentUpdater } from '@/study';

/**
 * User data and authentication
 */
export interface UserDBInterface extends DocumentUpdater {
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

  getUsername(): string;

  isLoggedIn(): boolean;

  /**
   * Get user configuration
   */
  getConfig(): Promise<UserConfig>;

  /**
   * Update user configuration
   */
  setConfig(config: Partial<UserConfig>): Promise<void>;

  /**
   * Record a user's interaction with a card
   */
  putCardRecord<T extends CardRecord>(record: T): Promise<CardHistory<CardRecord>>;

  /**
   * Get cards that the user has seen
   */
  getSeenCards(courseId?: string): Promise<string[]>;

  /**
   * Get cards that are actively scheduled for review
   */
  getActiveCards(): Promise<string[]>;

  /**
   * Register user for a course
   */
  registerForCourse(courseId: string, previewMode?: boolean): Promise<PouchDB.Core.Response>;

  /**
   * Drop a course registration
   */
  dropCourse(courseId: string, dropStatus?: string): Promise<PouchDB.Core.Response>;

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
  removeScheduledCardReview(username: string, reviewId: string): Promise<void>;

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
   * Get user's classroom registrations
   */
  getUserClassrooms(): Promise<ClassroomRegistrationDoc>;

  /**
   * Get user's active classes
   */
  getActiveClasses(): Promise<string[]>;

  /**
   * Update user's ELO rating for a course
   */
  updateUserElo(courseId: string, elo: CourseElo): Promise<PouchDB.Core.Response>;

  getCourseInterface(courseId: string): Promise<UsrCrsDataInterface>;
}

export interface UserCourseSettings {
  [setting: string]: string | number | boolean;
}

// [ ] reconsider here. Should maybe be generic type based on <T extends StudyContentSource> ?
export interface UsrCrsDataInterface {
  getScheduledReviewCount(): Promise<number>;
  getCourseSettings(): Promise<UserCourseSettings>;
  // getRegistrationDoc(): Promise<CourseRegistration>;
}
