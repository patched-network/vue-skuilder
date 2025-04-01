import { ClassroomConfig } from '@vue-skuilder/common';
import { ScheduledCard } from '../types/user';
import { StudySessionNewItem, StudySessionReviewItem } from './contentSource';

/**
 * Classroom management
 */
export interface ClassroomDBInterface {
  /**
   * Get classroom config
   */
  getConfig(): ClassroomConfig;

  /**
   * Get assigned content
   */
  getAssignedContent(): Promise<AssignedContent[]>;
}

export interface TeacherClassroomDBInterface extends ClassroomDBInterface {
  /**
   * For teacher interfaces: assign content
   */
  assignContent?(content: AssignedContent): Promise<boolean>;

  /**
   * For teacher interfaces: remove content
   */
  removeContent?(content: AssignedContent): Promise<void>;
}

export interface StudentClassroomDBInterface extends ClassroomDBInterface {
  /**
   * For student interfaces: get pending reviews
   */
  getPendingReviews?(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;

  /**
   * For student interfaces: get new cards
   */
  getNewCards?(limit?: number): Promise<StudySessionNewItem[]>;
}

export type AssignedContent = AssignedCourse | AssignedTag | AssignedCard;

export interface AssignedTag extends ContentBase {
  type: 'tag';
  tagID: string;
}
export interface AssignedCourse extends ContentBase {
  type: 'course';
}
export interface AssignedCard extends ContentBase {
  type: 'card';
  cardID: string;
}

interface ContentBase {
  type: 'course' | 'tag' | 'card';
  /**
   * Username of the assigning teacher.
   */
  assignedBy: string;
  /**
   * Date the content was assigned.
   */
  assignedOn: moment.Moment;
  /**
   * A 'due' date for this assigned content, for scheduling content
   * in advance. Content will not be actively pushed to students until
   * this date.
   */
  activeOn: moment.Moment;
  courseID: string;
}
