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
