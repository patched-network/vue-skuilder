import { CourseConfig } from '@vue-skuilder/common';
import { ScheduledCard } from '../types/user';
import { CourseRegistrationDoc, CourseRegistration, ActivityRecord } from '../types/user';
import { CardRecord, CardHistory } from '../types/types-legacy';
import { UserConfig } from '../types/user';

/**
 * User representation
 */
export interface UserInstanceInterface {
  username: string;

  /**
   * Create an account
   */
  createAccount(
    username: string,
    password: string
  ): Promise<{
    status: number;
    error: string;
  }>;

  /**
   * Log in
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
   * Log out
   */
  logout(): Promise<{
    ok: boolean;
  }>;

  /**
   * Get user config
   */
  getConfig(): Promise<UserConfig>;

  /**
   * Set user config
   */
  setConfig(items: Partial<UserConfig>): Promise<void>;

  /**
   * Get course registrations
   */
  getCourseRegistrationsDoc(): Promise<
    CourseRegistrationDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta
  >;

  /**
   * Get active courses
   */
  getActiveCourses(): Promise<CourseRegistration[]>;

  /**
   * Get active cards
   */
  getActiveCards(): Promise<string[]>;

  /**
   * Get activity records
   */
  getActivityRecords(): Promise<ActivityRecord[]>;

  /**
   * Get future reviews
   */
  getReviewsForcast(daysCount: number): Promise<ScheduledCard[]>;

  /**
   * Get pending reviews
   */
  getPendingReviews(courseId?: string): Promise<ScheduledCard[]>;

  /**
   * Get scheduled review count
   */
  getScheduledReviewCount(courseId: string): Promise<number>;

  /**
   * Get registered courses
   */
  getRegisteredCourses(): Promise<CourseRegistration[]>;

  /**
   * Get course registration document
   */
  getCourseRegDoc(courseId: string): Promise<CourseRegistration | undefined>;

  /**
   * Register for a course
   */
  registerForCourse(courseId: string, previewMode?: boolean): Promise<PouchDB.Core.Response>;

  /**
   * Drop a course
   */
  dropCourse(courseId: string, dropStatus?: string): Promise<PouchDB.Core.Response>;

  /**
   * Get user editable courses
   */
  getUserEditableCourses(): Promise<PouchDB.Core.AllDocsResponse<CourseConfig>>;

  /**
   * Store a card record
   */
  putCardRecord<T extends CardRecord>(record: T): Promise<CardHistory<CardRecord>>;

  /**
   * Get seen cards
   */
  getSeenCards(courseId?: string): Promise<PouchDB.Core.DocumentId[]>;

  /**
   * Get card history
   */
  getHistory(): Promise<(CardHistory<CardRecord> | null | undefined)[]>;

  /**
   * Update course settings
   */
  updateCourseSettings(
    courseId: string,
    settings: { key: string; value: string | number | boolean }[]
  ): Promise<void>;

  /**
   * Get course settings
   */
  getCourseSettings(
    courseId: string
  ): Promise<{ [key: string]: string | number | boolean } | undefined>;

  /**
   * Get active classes
   */
  getActiveClasses(): Promise<string[]>;
}
