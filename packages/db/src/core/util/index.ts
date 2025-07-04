import { DocType, DocTypePrefixes, CardHistory, CardRecord, QuestionRecord } from '../types/types-legacy';

export function areQuestionRecords(h: CardHistory<CardRecord>): h is CardHistory<QuestionRecord> {
  return isQuestionRecord(h.records[0]);
}

export function isQuestionRecord(c: CardRecord): c is QuestionRecord {
  return (c as QuestionRecord).userAnswer !== undefined;
}

export function getCardHistoryID(courseID: string, cardID: string): PouchDB.Core.DocumentId {
  return `${DocTypePrefixes[DocType.CARDRECORD]}-${courseID}-${cardID}`;
}

export function parseCardHistoryID(id: string): {
  courseID: string;
  cardID: string;
} {
  const split = id.split('-');
  let error: string = '';
  error += split.length === 3 ? '' : `\n\tgiven ID has incorrect number of '-' characters`;
  error +=
    split[0] === DocTypePrefixes[DocType.CARDRECORD] ? '' : `
	given ID does not start with ${DocTypePrefixes[DocType.CARDRECORD]}`;

  if (split.length === 3 && split[0] === DocTypePrefixes[DocType.CARDRECORD]) {
    return {
      courseID: split[1],
      cardID: split[2],
    };
  } else {
    throw new Error('parseCardHistory Error:' + error);
  }
}

interface PouchDBError extends Error {
  error?: string;
  reason?: string;
}

export function docIsDeleted(e: PouchDBError): boolean {
  return Boolean(e?.error === 'not_found' && e?.reason === 'deleted');
}
