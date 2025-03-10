import { StudentClassroomDB } from './classroomDB';
import { CourseDB } from './courseDB';
import { ScheduledCard } from './userDB';

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
  qualifiedID: `${string}-${string}` | `${string}-${string}-${number}`;
  cardID: string;
  contentSourceType: 'course' | 'classroom';
  contentSourceID: string;
  courseID: string;
  // reviewID?: string;
}

export interface ContentSourceID {
  type: 'course' | 'classroom';
  id: string;
}

export interface StudyContentSource {
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}

export async function getStudySource(source: ContentSourceID): Promise<StudyContentSource> {
  if (source.type === 'classroom') {
    return await StudentClassroomDB.factory(source.id);
  } else {
    // if (source.type === 'course') - removed so tsc is certain something returns
    return new CourseDB(source.id);
  }
}
