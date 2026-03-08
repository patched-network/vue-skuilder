import { TaggedPerformance } from './course-data.js';

export class EloRanker {
  constructor(public k: number = 32) {}

  setKFactor(k: number): void {
    this.k = k;
  }
  getKFactor(): number {
    return this.k;
  }

  getExpected(a: number, b: number): number {
    return 1 / (1 + Math.pow(10, (b - a) / 400));
  }
  updateRating(expected: number, actual: number, current: number): number {
    return Math.round(current + this.k * (actual - expected));
  }
}

export type CourseElo = {
  global: EloRank;
  tags: {
    [tagID: string]: EloRank;
  };
  misc: {
    [eloID: string]: EloRank;
  };
};

type EloRank = {
  score: number;
  count: number;
};

type Eloish = number | EloRank | CourseElo;

export function blankCourseElo(): CourseElo {
  return {
    global: {
      score: 990 + Math.round(Math.random() * 20),
      count: 0,
    },
    tags: {},
    misc: {},
  };
}

export function EloToNumber(elo: Eloish): number {
  if (typeof elo === 'number') {
    return elo;
  } else if (isCourseElo(elo)) {
    return elo.global.score;
  }
  {
    return elo.score;
  }
}
export function toElo(elo: number | EloRank): EloRank {
  if (typeof elo === 'number') {
    return {
      score: elo,
      count: 0,
    };
  } else {
    return elo;
  }
}
export function toCourseElo(elo: Eloish | undefined): CourseElo {
  if (typeof elo === 'string') {
    throw new Error('unsuitiably typed input to toCourseElo');
  }
  if (typeof elo === 'number') {
    return {
      global: {
        score: elo,
        count: 0,
      },
      misc: {},
      tags: {},
    };
  } else if (isCourseElo(elo)) {
    return elo;
  } else if (elo === undefined) {
    return {
      global: {
        score: 995 + Math.random() * 10,
        count: 0,
      },
      tags: {},
      misc: {},
    };
  } else {
    return {
      global: elo,
      tags: {},
      misc: {},
    };
  }
}

export function isCourseElo(x: unknown): x is CourseElo {
  if (!x || typeof x !== 'object') {
    return false;
  }

  return 'global' in x && 'tags' in x;
}

/**
 * Calculates updated ELO scores for users and content after they interact
 *
 * @param userElo current ELO score of the user
 * @param cardElo current ELO score of the card
 * @param userScore user performance against the card in range [0,1]
 * @param k optional scaling factor. Higher values -> larger score adjustments. Default 32.
 * @returns
 */
export function adjustCourseScores(
  aElo: Eloish,
  bElo: Eloish,
  userScore: number,
  options?: {
    globalOnly: boolean;
  }
): {
  userElo: CourseElo;
  cardElo: CourseElo;
} {
  if (userScore < 0 || userScore > 1) {
    throw new Error(`ELO performance rating must be between 0 and 1 - received ${userScore}`);
  }

  const userElo: CourseElo = toCourseElo(aElo);
  const cardElo: CourseElo = toCourseElo(bElo);

  if (options == undefined || !options.globalOnly) {
    // grade on each tag present for the card
    Object.keys(cardElo.tags).forEach((k) => {
      const userTagElo: EloRank = userElo.tags[k]
        ? userElo.tags[k]
        : {
            count: 0,
            score: userElo.global.score, // todo: 1000?
          };
      const adjusted = adjustScores(userTagElo, cardElo.tags[k], userScore);
      userElo.tags[k] = adjusted.userElo;
      cardElo.tags[k] = adjusted.cardElo;
    });
  }

  const adjusted = adjustScores(userElo.global, cardElo.global, userScore);
  userElo.global = adjusted.userElo;
  cardElo.global = adjusted.cardElo;

  return {
    userElo,
    cardElo,
  };
}

function adjustScores(
  userElo: EloRank,
  cardElo: EloRank,
  userScore: number
): {
  userElo: EloRank;
  cardElo: EloRank;
} {
  if (userScore < 0 || userScore > 1) {
    throw new Error(`ELO performance rating must be between 0 and 1 - received ${userScore}`);
  }

  // todo: how to calculate here?
  // todo: should / must these be equal?
  // todo: 176 - these K values should be a fcn of `.count` values of userElo and cardElo
  const userRanker = new EloRanker(16);
  const cardRanker = new EloRanker(16);

  const exp = userRanker.getExpected(userElo.score, cardElo.score);

  const updatedUserElo = userRanker.updateRating(exp, userScore, userElo.score);
  const updatedCardElo = cardRanker.updateRating(1 - exp, 1 - userScore, cardElo.score);

  return {
    userElo: {
      score: updatedUserElo,
      count: userElo.count + 1,
    },
    cardElo: {
      score: updatedCardElo,
      count: cardElo.count + 1,
    },
  };
}

/**
 * Adjusts ELO scores with per-tag granularity.
 *
 * Unlike adjustCourseScores which applies the same score to all tags,
 * this function allows different scores per tag for granular skill tracking.
 *
 * Tags can be scored (number 0-1) or count-only (null). Count-only tags are
 * useful for exposure tracking (e.g., gpc:expose:*) where we only care about
 * "how many times has the user seen this?" without measuring performance.
 *
 * @param aElo - User's current ELO (will be converted to CourseElo)
 * @param bElo - Card's current ELO (will be converted to CourseElo)
 * @param taggedPerformance - Object with _global score and per-tag scores/null
 * @returns Updated user and card ELOs
 *
 * @example
 * // Spelling "cat" as "kat" - got 'a' and 't' right, but 'c' wrong
 * adjustCourseScoresPerTag(userElo, cardElo, {
 *   _global: 0.67,
 *   'gpc:exercise:c-K': 0,
 *   'gpc:exercise:a-AE': 1,
 *   'gpc:exercise:t-T': 1,
 * });
 *
 * @example
 * // WhoSaidThat - exercise target, expose distractors (count-only)
 * adjustCourseScoresPerTag(userElo, cardElo, {
 *   _global: 1.0,
 *   'gpc:exercise:sh-SH': 1.0,
 *   'gpc:expose:s-S': null,      // count-only
 *   'gpc:expose:ch-CH': null,    // count-only
 * });
 */
export function adjustCourseScoresPerTag(
  aElo: Eloish,
  bElo: Eloish,
  taggedPerformance: TaggedPerformance
): {
  userElo: CourseElo;
  cardElo: CourseElo;
} {
  const globalScore = taggedPerformance._global;

  if (globalScore < 0 || globalScore > 1) {
    throw new Error(`ELO _global score must be between 0 and 1 - received ${globalScore}`);
  }

  const userElo: CourseElo = toCourseElo(aElo);
  const cardElo: CourseElo = toCourseElo(bElo);

  // Process each tag in the performance object
  for (const [key, tagScore] of Object.entries(taggedPerformance)) {
    if (key === '_global') continue;

    // Count-only tag (exposure tracking): increment count, use -1 sentinel score
    if (tagScore === null) {
      userElo.tags[key] = userElo.tags[key] ?? { count: 0, score: -1 };
      userElo.tags[key] = {
        ...userElo.tags[key],
        count: userElo.tags[key].count + 1,
        score: -1, // Sentinel: clearly not a real ELO score
      };
      // Skip card ELO update for count-only tags
      continue;
    }

    if (typeof tagScore !== 'number' || tagScore < 0 || tagScore > 1) {
      throw new Error(`ELO tag score for '${key}' must be between 0 and 1 - received ${tagScore}`);
    }

    // Initialize tag ELO on user if missing (use global score as baseline)
    const userTagElo: EloRank = userElo.tags[key] ?? {
      count: 0,
      score: userElo.global.score,
    };

    // Initialize tag ELO on card if missing (use global score as baseline)
    const cardTagElo: EloRank = cardElo.tags[key] ?? {
      count: 0,
      score: cardElo.global.score,
    };

    // Apply per-tag score
    const adjusted = adjustScores(userTagElo, cardTagElo, tagScore);
    userElo.tags[key] = adjusted.userElo;
    cardElo.tags[key] = adjusted.cardElo;
  }

  // Apply global score to global ELO
  const adjustedGlobal = adjustScores(userElo.global, cardElo.global, globalScore);
  userElo.global = adjustedGlobal.userElo;
  cardElo.global = adjustedGlobal.cardElo;

  return {
    userElo,
    cardElo,
  };
}
