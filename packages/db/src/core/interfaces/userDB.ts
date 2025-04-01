import { CourseElo } from '@vue-skuilder/common';
import { Moment } from 'moment';
import { CourseRegistration, CourseRegistrationDoc, ScheduledCard } from '@/core/types/user';
import { UserInstanceInterface } from './user';
import { UserConfig } from '../types/user';
import { ClassroomRegistrationDoc } from '@/pouch/userDB';
import { CardHistory, CardRecord } from '../types/types-legacy';

/**
 * User data and authentication
 */
export interface UserDBInterface {
  /**
   * Check if a user exists
   */
  doesUserExist(username: string): Promise<boolean>;

  /**
   * Create a new user account
   */
  createAccount(
    username: string,
    password: string
  ): Promise<{
    status: number;
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

  /**
   * Get the current user
   */
  getCurrentUser(): Promise<UserInstanceInterface>;

  /**
   * Get user configuration
   */
  getUserConfig(username: string): Promise<UserConfig>;

  /**
   * Update user configuration
   */
  updateUserConfig(username: string, config: Partial<UserConfig>): Promise<void>;

  /**
   * Get card history for a specific card
   */
  getCardHistory(courseId: string, cardId: string): Promise<CardHistory<CardRecord>>;

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
  registerForCourse(
    username: string,
    courseId: string,
    previewMode?: boolean
  ): Promise<PouchDB.Core.Response>;

  /**
   * Drop a course registration
   */
  dropCourse(
    username: string,
    courseId: string,
    dropStatus?: string
  ): Promise<PouchDB.Core.Response>;

  /**
   * Get user's course registrations
   */
  getCourseRegistrations(username: string): Promise<CourseRegistrationDoc>;

  /**
   * Get user's active courses
   */
  getActiveCourses(username: string): Promise<CourseRegistration[]>;

  /**
   * Get user's pending reviews
   */
  getPendingReviews(username: string, courseId?: string): Promise<ScheduledCard[]>;

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
    username: string,
    classId: string,
    registerAs: 'student' | 'teacher' | 'aide' | 'admin'
  ): Promise<PouchDB.Core.Response>;

  /**
   * Drop user from classroom
   */
  dropFromClassroom(username: string, classId: string): Promise<PouchDB.Core.Response>;

  /**
   * Get user's classroom registrations
   */
  getUserClassrooms(username: string): Promise<ClassroomRegistrationDoc>;

  /**
   * Get user's active classes
   */
  getActiveClasses(username: string): Promise<string[]>;

  /**
   * Update user's ELO rating for a course
   */
  updateUserElo(username: string, courseId: string, elo: CourseElo): Promise<PouchDB.Core.Response>;
}
