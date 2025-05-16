import { StudyContentSource } from '../interfaces/contentSource';
import { DocType, SkuilderCourseData } from './types-legacy';
import {
  CourseDBInterface,
  ScheduledCard,
  StudySessionNewItem,
  StudySessionReviewItem,
  UserDBInterface,
} from '../index';
import { Navigators } from '../navigators';
import ELONavigator from '../navigators/elo';

/**
 *
 */
export interface ContentNavigationStrategyData extends SkuilderCourseData {
  id: string;
  docType: DocType.NAVIGATION_STRATEGY;
  name: string;
  description: string;
  /**
   The name of the class that implements the navigation strategy at runtime.
   */
  implementingClass: string;

  /**
   A representation of the strategy's parameterization - to be deserialized
   by the implementing class's constructor at runtime.
  */
  serializedData: string;
}
