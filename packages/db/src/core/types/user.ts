import { CourseElo } from '@vue-skuilder/common';
import { Moment } from 'moment';

export interface SessionTrackingData {
  peekSessionCount: number;
  studySessionCount: number;
  sessionCount: number; // total
  firstSessionDate: string;
  lastSessionDate: string;
  signupPrompted: boolean;
  promptDismissalCount: number;
  studyModeAcknowledged: boolean;
}

export interface UserConfig {
  darkMode: boolean;
  likesConfetti: boolean;
  sessionTimeLimit: number; // Session time limit in minutes
  email?: string; // Optional email for verification flows (added for enhanced auth)

  // Session tracking for trial enforcement (per-course)
  // Key is courseId (e.g., 'letterspractice-basic')
  sessionTracking?: Record<string, SessionTrackingData>;
}

export interface ActivityRecord {
  timeStamp: number | string;
  [key: string]: any;
}

export interface CourseRegistration {
  status?: 'active' | 'dropped' | 'maintenance-mode' | 'preview';
  courseID: string;
  admin: boolean;
  moderator: boolean;
  user: boolean;
  settings?: {
    [setting: string]: string | number | boolean;
  };
  elo: number | CourseElo;
}

interface StudyWeights {
  [courseID: string]: number;
}

export interface CourseRegistrationDoc {
  courses: CourseRegistration[];
  studyWeight: StudyWeights;
}

export interface ScheduledCard {
  _id: PouchDB.Core.DocumentId;

  /**
   * The docID of the card to be reviewed
   */
  cardId: PouchDB.Core.DocumentId;
  /**
   * The ID of the course
   */
  courseId: string;
  /**
   * The time at which the card becomes eligible for review.
   *
   * (Should probably be UTC adjusted so that performance is
   * not wonky across time zones)
   * 
   * Note: Stored as ISO string for PouchDB serialization compatibility,
   * but can be consumed as Moment objects via moment.utc(reviewTime)
   */
  reviewTime: string | Moment;

  /**
   * The time at which this scheduled event was created.
   * 
   * Note: Stored as ISO string for PouchDB serialization compatibility,
   * but can be consumed as Moment objects via moment.utc(scheduledAt)
   */
  scheduledAt: string | Moment;

  /**
   * Classifying whether this card is scheduled on behalf of a
   * user-registered course or by as assigned content from a
   * user-registered classroom
   */
  scheduledFor: 'course' | 'classroom';

  /**
   * The ID of the course or classroom that requested this card
   */
  schedulingAgentId: string;
}
