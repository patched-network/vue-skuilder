import { Evaluation } from './course-data.js';
import { Answer } from './interfaces/AnswerInterfaces.js';
import { CourseElo } from './elo.js';
import { Moment } from 'moment';

export enum DocType {
  DISPLAYABLE_DATA = 'DISPLAYABLE_DATA',
  CARD = 'CARD',
  DATASHAPE = 'DATASHAPE',
  QUESTIONTYPE = 'QUESTION',
  VIEW = 'VIEW',
  PEDAGOGY = 'PEDAGOGY',
  CARDRECORD = 'CARDRECORD',
  SCHEDULED_CARD = 'SCHEDULED_CARD',
  TAG = 'TAG',
}

/**
 * Interface for all data on course content and pedagogy stored
 * in the c/pouch database.
 */
export interface SkuilderCourseData {
  course: string;
  docType: DocType;
}

export interface Tag extends SkuilderCourseData {
  docType: DocType.TAG;
  name: string;
  snippet: string; // 200 char description of the tag
  wiki: string; // 3000 char md-friendly description
  taggedCards: PouchDB.Core.DocumentId[];
  author: string;
}
export interface TagStub {
  name: string;
  snippet: string;
  count: number; // the number of cards that have this tag applied
}

export interface CardData extends SkuilderCourseData {
  docType: DocType.CARD;
  id_displayable_data: PouchDB.Core.DocumentId[];
  id_view: PouchDB.Core.DocumentId;
  elo: CourseElo;
  author: string;
}

/** A list of populated courses in the DB */
export interface CourseListData extends PouchDB.Core.Response {
  courses: string[];
}

/**
 * The data used to hydrate viewable components (questions, info, etc)
 */
export interface DisplayableData extends SkuilderCourseData {
  docType: DocType.DISPLAYABLE_DATA;
  author?: string;
  id_datashape: PouchDB.Core.DocumentId;
  data: Field[];
  _attachments?: { [index: string]: PouchDB.Core.FullAttachment };
}

export interface Field {
  data: unknown;
  name: string;
}

export interface DataShapeData extends SkuilderCourseData {
  docType: DocType.DATASHAPE;
  _id: PouchDB.Core.DocumentId;
  questionTypes: PouchDB.Core.DocumentId[];
}

export interface QuestionData extends SkuilderCourseData {
  docType: DocType.QUESTIONTYPE;
  _id: PouchDB.Core.DocumentId;
  viewList: string[];
  dataShapeList: PouchDB.Core.DocumentId[];
}

const cardHistoryPrefix = 'cardH';

export function getCardHistoryID(courseID: string, cardID: string): PouchDB.Core.DocumentId {
  return `${cardHistoryPrefix}-${courseID}-${cardID}`;
}

export function parseCardHistoryID(id: string): {
  courseID: string;
  cardID: string;
} {
  const split = id.split('-');
  let error: string = '';
  error += split.length === 3 ? '' : `\n\tgiven ID has incorrect number of '-' characters`;
  error +=
    split[0] === cardHistoryPrefix ? '' : `\n\tgiven ID does not start with ${cardHistoryPrefix}`;

  if (split.length === 3 && split[0] === cardHistoryPrefix) {
    return {
      courseID: split[1],
      cardID: split[2],
    };
  } else {
    throw new Error('parseCardHistory Error:' + error);
  }
}

export interface CardHistory<T extends CardRecord> {
  _id: PouchDB.Core.DocumentId;
  /**
   * The CouchDB id of the card
   */
  cardID: PouchDB.Core.DocumentId;

  /**
   * The ID of the course
   */
  courseID: string;

  /**
   * The to-date largest interval between successful
   * card reviews. `0` indicates no successful reviews.
   */
  bestInterval: number;

  /**
   * The number of times that a card has been
   * failed in review
   */
  lapses: number;

  /**
   * The number of consecutive successful impressions
   * on this card
   */
  streak: number;

  records: T[];
}

export interface CardRecord {
  /**
   * The CouchDB id of the card
   */
  cardID: string;
  /**
   * The ID of the course
   */
  courseID: string;
  /**
   * Number of milliseconds that the user spent before dismissing
   * the card (ie, "I've read this" or "here is my answer")
   *
   * //TODO: this (sometimes?) wants to be replaced with a rich
   *         recording of user activity in working the question
   */
  timeSpent: number;
  /**
   * The date-time that the card was rendered. timeStamp + timeSpent will give the
   * time of user submission.
   */
  timeStamp: Moment;
}

export interface QuestionRecord extends CardRecord, Evaluation {
  userAnswer: Answer;
  /**
   * The number of incorrect user submissions prededing this submisstion.
   *
   * eg, if a user is asked 7*6=__, submitting 46, 48, 42 will result in three
   * records being created having 0, 1, and 2 as their recorded 'priorAttempts' values
   */
  priorAttemps: number;
}

export function areQuestionRecords(h: CardHistory<CardRecord>): h is CardHistory<QuestionRecord> {
  return isQuestionRecord(h.records[0]);
}

export function isQuestionRecord(c: CardRecord): c is QuestionRecord {
  return (c as QuestionRecord).userAnswer !== undefined;
}
