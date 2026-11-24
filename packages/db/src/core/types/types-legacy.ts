// The course-doc types (DocType, CardData, CardRecord, ...) live in
// @vue-skuilder/common. This module used to keep its own copies, which
// drifted (db's DocType and CardRecord grew; common's didn't) and made db's
// types and common's mutually incompatible. They are re-exported here so
// existing `@vue-skuilder/db` imports keep working.
import { logger } from '../../util/logger';
import { DocType } from '@vue-skuilder/common';

export {
  DocType,
  type SkuilderCourseData,
  type Tag,
  type TagStub,
  type CardData,
  type CourseListData,
  type DisplayableData,
  type Field,
  type DataShapeData,
  type QuestionData,
  type CardHistory,
  type CardRecord,
  type QuestionRecord,
} from '@vue-skuilder/common';

export const GuestUsername: string = 'sk-guest-';

export const log = (message: string): void => {
  logger.log(message);
};

export interface QualifiedCardID {
  courseID: string;
  cardID: string;
}

export const DocTypePrefixes = {
  [DocType.CARD]: 'c',
  [DocType.DISPLAYABLE_DATA]: 'dd',
  [DocType.TAG]: 'TAG',
  [DocType.CARDRECORD]: 'cardH',
  [DocType.SCHEDULED_CARD]: 'card_review_',
  // Add other doctypes here as they get prefixed IDs
  [DocType.DATASHAPE]: 'DATASHAPE',
  [DocType.QUESTIONTYPE]: 'QUESTION',
  [DocType.VIEW]: 'VIEW',
  [DocType.PEDAGOGY]: 'PEDAGOGY',
  [DocType.NAVIGATION_STRATEGY]: 'NAVIGATION_STRATEGY',
  [DocType.STRATEGY_STATE]: 'STRATEGY_STATE',
  [DocType.USER_OUTCOME]: 'USER_OUTCOME',
  [DocType.STRATEGY_LEARNING_STATE]: 'STRATEGY_LEARNING_STATE',
  [DocType.STUDY_SESSION]: 'SESSION',
} as const;
