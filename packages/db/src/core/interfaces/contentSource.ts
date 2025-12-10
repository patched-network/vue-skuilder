import { getDataLayer } from '@db/factory';
import { UserDBInterface } from '..';
import { StudentClassroomDB } from '../../impl/couch/classroomDB';
import { WeightedCard } from '../navigators';
import { TagFilter, hasActiveFilter } from '@vue-skuilder/common';
import { TagFilteredContentSource } from '../../study/TagFilteredContentSource';

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
  /**
   * Optional tag filter for scoped study sessions.
   * When present, creates a TagFilteredContentSource instead of a regular course source.
   */
  tagFilter?: TagFilter;
}

// #region docs_StudyContentSource
/**
 * Interface for sources that provide study content to SessionController.
 *
 * Content sources return scored candidates via getWeightedCards(), which
 * SessionController uses to populate study queues.
 *
 * See: packages/db/docs/navigators-architecture.md
 */
export interface StudyContentSource {
  /**
   * Get cards with suitability scores for presentation.
   *
   * Returns unified scored candidates that can be sorted and selected by SessionController.
   * The card origin ('new' | 'review' | 'failed') is determined by provenance metadata.
   *
   * @param limit - Maximum number of cards to return
   * @returns Cards sorted by score descending
   */
  getWeightedCards(limit: number): Promise<WeightedCard[]>;
}
// #endregion docs_StudyContentSource

export async function getStudySource(
  source: ContentSourceID,
  user: UserDBInterface
): Promise<StudyContentSource> {
  if (source.type === 'classroom') {
    return await StudentClassroomDB.factory(source.id, user);
  } else {
    // Check if this is a tag-filtered course source
    if (hasActiveFilter(source.tagFilter)) {
      return new TagFilteredContentSource(source.id, source.tagFilter!, user);
    }

    // Regular course source
    return getDataLayer().getCourseDB(source.id) as unknown as StudyContentSource;
  }
}
