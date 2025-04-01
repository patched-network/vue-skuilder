import { cardHistoryPrefix, CardHistory, CardRecord, QuestionRecord } from '../types/types-legacy';

export function areQuestionRecords(h: CardHistory<CardRecord>): h is CardHistory<QuestionRecord> {
  return isQuestionRecord(h.records[0]);
}

export function isQuestionRecord(c: CardRecord): c is QuestionRecord {
  return (c as QuestionRecord).userAnswer !== undefined;
}

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
