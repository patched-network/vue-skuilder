import { Question, ViewComponent } from '@vue-skuilder/common-ui';
import { Answer, SeedMeta, ViewData } from '@vue-skuilder/common';
import MissingAddend from './missingAddend.vue';
import Split from './split.vue';
import { NumberBondDataShape } from './shapes.js';

type BondItem = { whole: number; part: number };

/**
 * Every split of 2..10 into two nonzero parts. Bonds to 10 are the subset
 * with whole = 10.
 */
const data = function () {
  const ret: BondItem[] = [];
  for (let whole = 2; whole <= 10; whole++) {
    for (let part = 1; part < whole; part++) {
      ret.push({ whole, part });
    }
  }
  return ret;
};

/**
 * Starting ELO rises with the whole: 990 for splits of 2, 1150 for bonds to
 * 10. The existing single-digit facts sit near 1000.
 */
const seedMeta = (item: unknown): SeedMeta => {
  const { whole } = item as BondItem;
  return {
    tags: ['number-bond', `bond-${whole}`],
    elo: 950 + 20 * whole,
  };
};

export class NumberBond extends Question {
  public static dataShapes = [NumberBondDataShape];

  public static views: ViewComponent[] = [MissingAddend, Split];

  public whole: number;
  public part: number;

  public static seedData = data();
  public static seedMeta = seedMeta;
  public static acceptsUserData = false;

  constructor(data: ViewData[]) {
    super(data);
    this.whole = data[0].whole as number;
    this.part = data[0].part as number;
  }

  public isCorrect(answer: Answer) {
    return this.whole - this.part === answer;
  }

  public dataShapes() {
    return NumberBond.dataShapes;
  }

  public views() {
    return NumberBond.views;
  }
}
