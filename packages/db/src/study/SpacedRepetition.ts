import { CardHistory, CardRecord, QuestionRecord } from '@db/core/types/types-legacy';
import { areQuestionRecords } from '@db/core/util';
import { Update } from '@db/impl/couch/updateQueue';
import moment from 'moment';
import { logger } from '../util/logger';

type Moment = moment.Moment;
const duration = moment.duration;

export interface DocumentUpdater {
  update<T extends PouchDB.Core.Document<object>>(id: string, update: Update<T>): Promise<T>;
}

/**
 * Returns the minimum number of seconds that should pass before a
 * card is redisplayed for review / practice.
 *
 * @param cardHistory The user's history working with the given card
 */
export function newInterval(user: DocumentUpdater, cardHistory: CardHistory<CardRecord>): number {
  if (areQuestionRecords(cardHistory)) {
    return newQuestionInterval(user, cardHistory);
  } else {
    return 100000; // random - replace
  }
}

function newQuestionInterval(user: DocumentUpdater, cardHistory: CardHistory<QuestionRecord>) {
  const records = cardHistory.records;
  const currentAttempt = records[records.length - 1];
  const lastInterval: number = lastSuccessfulInterval(records);

  if (lastInterval > cardHistory.bestInterval) {
    cardHistory.bestInterval = lastInterval;
    // update bestInterval on cardHistory in db
    void user.update<CardHistory<QuestionRecord>>(cardHistory._id, {
      bestInterval: lastInterval,
    });
  }

  if (currentAttempt.isCorrect) {
    const skill = Math.min(1.0, Math.max(0.0, currentAttempt.performance as number));
    logger.debug(`Demontrated skill: \t${skill}`);
    const interval: number = lastInterval * (0.75 + skill);
    cardHistory.lapses = getLapses(cardHistory.records);
    cardHistory.streak = getStreak(cardHistory.records);

    if (
      cardHistory.lapses &&
      cardHistory.streak &&
      cardHistory.bestInterval &&
      (cardHistory.lapses >= 0 || cardHistory.streak >= 0)
    ) {
      // weighted average of best-ever performance vs current performance, based
      // on how often the card has been failed, and the current streak of success
      const ret =
        (cardHistory.lapses * interval + cardHistory.streak * cardHistory.bestInterval) /
        (cardHistory.lapses + cardHistory.streak);
      logger.debug(`Weighted average interval calculation:
\t(${cardHistory.lapses} * ${interval} + ${cardHistory.streak} * ${cardHistory.bestInterval}) / (${cardHistory.lapses} + ${cardHistory.streak}) = ${ret}`);
      return ret;
    } else {
      return interval;
    }
  } else {
    return 0;
  }
}

/**
 * Returns the amount of time, in seconds, of the most recent successful
 * interval for this card. An interval is successful if the user answers
 * a question correctly on the first attempt.
 *
 * @param cardHistory The record of user attempts with the question
 */
function lastSuccessfulInterval(cardHistory: QuestionRecord[]): number {
  for (let i = cardHistory.length - 1; i >= 1; i--) {
    if (cardHistory[i].priorAttemps === 0 && cardHistory[i].isCorrect) {
      const lastInterval = secondsBetween(cardHistory[i - 1].timeStamp, cardHistory[i].timeStamp);
      const ret = Math.max(lastInterval, 20 * 60 * 60);
      logger.debug(`Last interval w/ this card was: ${lastInterval}s, returning ${ret}s`);
      return ret;
    }
  }

  return getInitialInterval(cardHistory); // used as a magic number here - indicates no prior intervals
}

function getStreak(records: QuestionRecord[]): number {
  let streak = 0;
  let index = records.length - 1;

  while (index >= 0 && records[index].isCorrect) {
    index--;
    streak++;
  }

  return streak;
}
function getLapses(records: QuestionRecord[]): number {
  return records.filter((r) => r.isCorrect === false).length;
}

function getInitialInterval(cardHistory: QuestionRecord[]): number {
  logger.warn(`history of length: ${cardHistory.length} ignored!`);

  // todo make this a data-driven service, relying on:
  //  - global experience w/ the card (ie, what interval
  //      seems to be working well across the population)
  //  - the individual user (how do they respond in general
  //      when compared to the population)
  return 60 * 60 * 24 * 3; // 3 days
}

/**
 * Returns the time in seconds between two Moment objects
 * @param start The first time
 * @param end The second time
 */
function secondsBetween(start: Moment, end: Moment): number {
  // assertion guard against mis-typed json from database
  start = moment(start);
  end = moment(end);
  const ret = duration(end.diff(start)).asSeconds();
  // console.log(`From start: ${start} to finish: ${end} is ${ret} seconds`);
  return ret;
}
