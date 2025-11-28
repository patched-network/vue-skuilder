import { getDataLayer } from '@db/factory';
import { UserDBInterface } from '..';
import { StudentClassroomDB } from '../../impl/couch/classroomDB';
import { ScheduledCard } from '@db/core/types/user';
import { WeightedCard } from '../navigators';

// ============================================================================
// API MIGRATION NOTICE
// ============================================================================
//
// The StudyContentSource interface is being superseded by the ContentNavigator
// class and its getWeightedCards() API. See:
//   packages/db/src/core/navigators/ARCHITECTURE.md
//
// HISTORICAL CONTEXT:
// - This interface was designed to abstract 'classrooms' and 'courses' as
//   content sources for study sessions.
// - getNewCards() and getPendingReviews() were artifacts of two hard-coded
//   navigation strategies: ELO proximity (new) and SRS scheduling (reviews).
// - The new/review split reflected implementation details, not fundamentals.
//
// THE PROBLEM:
// - "What does 'get reviews' mean for an interference mitigator?" - it doesn't.
// - SRS is just one strategy that could express review urgency as scores.
// - Some strategies generate candidates, others filter/score them.
//
// THE SOLUTION:
// - ContentNavigator.getWeightedCards() returns unified scored candidates.
// - WeightedCard.source field distinguishes new/review/failed (metadata, not API).
// - Strategies compose via delegate pattern (filter wraps generator).
//
// MIGRATION PATH:
// 1. ContentNavigator implements StudyContentSource for backward compat
// 2. SessionController will migrate to call getWeightedCards()
// 3. Legacy methods will be deprecated, then removed
//
// ============================================================================

export type StudySessionFailedItem = StudySessionFailedNewItem | StudySessionFailedReviewItem;

export interface StudySessionFailedNewItem extends StudySessionItem {
  status: 'failed-new';
}
export interface StudySessionFailedReviewItem extends StudySessionReviewItem {
  status: 'failed-review';
}

export interface StudySessionNewItem extends StudySessionItem {
  status: 'new';
}

export interface StudySessionReviewItem extends StudySessionItem {
  reviewID: string;
  status: 'review' | 'failed-review';
}
export function isReview(item: StudySessionItem): item is StudySessionReviewItem {
  const ret = item.status === 'review' || item.status === 'failed-review' || 'reviewID' in item;

  // console.log(`itemIsReview: ${ret}
  // \t${JSON.stringify(item)}`);

  return ret;
}

export interface StudySessionItem {
  status: 'new' | 'review' | 'failed-new' | 'failed-review';
  contentSourceType: 'course' | 'classroom';
  contentSourceID: string;
  // qualifiedID: `${string}-${string}` | `${string}-${string}-${number}`;
  cardID: string;
  courseID: string;
  elo?: number;
  // reviewID?: string;
}

export interface ContentSourceID {
  type: 'course' | 'classroom';
  id: string;
}

// #region docs_StudyContentSource
/**
 * Interface for sources that provide study content to SessionController.
 *
 * @deprecated This interface will be superseded by ContentNavigator.getWeightedCards().
 * The getNewCards/getPendingReviews split was an artifact of hard-coded ELO and SRS
 * strategies. The new API returns unified WeightedCard[] with scores.
 *
 * MIGRATION:
 * - Implement ContentNavigator instead of StudyContentSource directly
 * - Override getWeightedCards() as the primary method
 * - Legacy methods can delegate to getWeightedCards() or be left as-is
 *
 * See: packages/db/src/core/navigators/ARCHITECTURE.md
 */
export interface StudyContentSource {
  /**
   * Get cards scheduled for review based on SRS algorithm.
   *
   * @deprecated Will be replaced by getWeightedCards() which returns scored candidates.
   * Review urgency will be expressed as a score rather than a separate method.
   */
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;

  /**
   * Get new cards for introduction, typically ordered by ELO proximity.
   *
   * @deprecated Will be replaced by getWeightedCards() which returns scored candidates.
   * New card selection and scoring will be unified with review scoring.
   *
   * @param n - Maximum number of new cards to return
   */
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;

  /**
   * Get cards with suitability scores for presentation.
   *
   * This is the PRIMARY API for content sources going forward. Returns unified
   * scored candidates that can be sorted and selected by SessionController.
   *
   * The `source` field on WeightedCard indicates origin ('new' | 'review' | 'failed')
   * for queue routing purposes during the migration period.
   *
   * @param limit - Maximum number of cards to return
   * @returns Cards sorted by score descending
   */
  getWeightedCards?(limit: number): Promise<WeightedCard[]>;
}
// #endregion docs_StudyContentSource

export async function getStudySource(
  source: ContentSourceID,
  user: UserDBInterface
): Promise<StudyContentSource> {
  if (source.type === 'classroom') {
    return await StudentClassroomDB.factory(source.id, user);
  } else {
    // if (source.type === 'course') - removed so tsc is certain something returns
    // return new CourseDB(source.id, async () => {
    //   return user;
    // });

    return getDataLayer().getCourseDB(source.id) as unknown as StudyContentSource;
  }
}
