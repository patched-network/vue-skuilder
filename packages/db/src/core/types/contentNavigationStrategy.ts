import { DocType, SkuilderCourseData } from './types-legacy';

/**
 *
 */
export interface ContentNavigationStrategyData extends SkuilderCourseData {
  id: string; // todo: enforce an id prefix
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
