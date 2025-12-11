import { Navigators } from './index';
import { Pipeline } from './Pipeline';
import CompositeGenerator from './CompositeGenerator';
import ELONavigator from './elo';
import SRSNavigator from './srs';
import { createEloDistanceFilter } from './filters/eloDistance';
import type { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { DocType } from '../types/types-legacy';
import type { CourseDBInterface, UserDBInterface } from '../interfaces';

/**
 * Default navigation pipeline configuration.
 *
 * This module provides factory functions for creating the canonical default
 * navigation pipeline used by both CouchDB and static course implementations.
 */

/**
 * Create default ELO navigation strategy data.
 * Used when no custom strategies are configured.
 *
 * @param courseId - The course ID to associate with this strategy
 * @returns Strategy data for default ELO navigation
 */
export function createDefaultEloStrategy(courseId: string): ContentNavigationStrategyData {
  return {
    _id: 'NAVIGATION_STRATEGY-ELO-default',
    docType: DocType.NAVIGATION_STRATEGY,
    name: 'ELO (default)',
    description: 'Default ELO-based navigation strategy for new cards',
    implementingClass: Navigators.ELO,
    course: courseId,
    serializedData: '',
  };
}

/**
 * Create default SRS navigation strategy data.
 * Used when no custom strategies are configured.
 *
 * @param courseId - The course ID to associate with this strategy
 * @returns Strategy data for default SRS navigation
 */
export function createDefaultSrsStrategy(courseId: string): ContentNavigationStrategyData {
  return {
    _id: 'NAVIGATION_STRATEGY-SRS-default',
    docType: DocType.NAVIGATION_STRATEGY,
    name: 'SRS (default)',
    description: 'Default SRS-based navigation strategy for reviews',
    implementingClass: Navigators.SRS,
    course: courseId,
    serializedData: '',
  };
}

/**
 * Creates the default navigation pipeline for courses with no configured strategies.
 *
 * Default: Pipeline(Composite(ELO, SRS), [eloDistanceFilter])
 * - ELO generator: scores new cards by skill proximity
 * - SRS generator: scores reviews by overdueness and interval recency
 * - ELO distance filter: penalizes cards far from user's current level
 *
 * This is the canonical default configuration used when:
 * - No navigation strategy documents exist in the course
 * - PipelineAssembler fails to build from strategy documents
 *
 * @param user - User database interface for accessing user state
 * @param course - Course database interface for accessing course data
 * @returns Configured Pipeline ready for use
 */
export function createDefaultPipeline(
  user: UserDBInterface,
  course: CourseDBInterface
): Pipeline {
  const courseId = course.getCourseID();
  const eloNavigator = new ELONavigator(user, course, createDefaultEloStrategy(courseId));
  const srsNavigator = new SRSNavigator(user, course, createDefaultSrsStrategy(courseId));

  const compositeGenerator = new CompositeGenerator([eloNavigator, srsNavigator]);
  const eloDistanceFilter = createEloDistanceFilter();

  return new Pipeline(compositeGenerator, [eloDistanceFilter], user, course);
}
