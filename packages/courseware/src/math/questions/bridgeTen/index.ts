import { Question, ViewComponent } from '@vue-skuilder/common-ui';
import { Answer, SeedMeta, ViewData } from '@vue-skuilder/common';
import Scaffold from './scaffold.vue';
import Compact from './compact.vue';
import { BridgeTenDataShape } from './shapes.js';

type BridgeItem = { a: number; b: number };

/**
 * Single-digit sums that cross 10, larger addend first: 8 + 5 is solved as
 * 8 + 2 (make 10) + 3 (the rest of 5). The answer is the part left over
 * after making 10.
 */
const data = function () {
  const ret: BridgeItem[] = [];
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= a; b++) {
      if (a + b > 10) {
        ret.push({ a, b });
      }
    }
  }
  return ret;
};

const seedMeta = (item: unknown): SeedMeta => {
  const { a, b } = item as BridgeItem;
  return {
    tags: ['bridge-10'],
    elo: 1200 + 10 * (a + b - 11),
  };
};

export class BridgeTen extends Question {
  public static dataShapes = [BridgeTenDataShape];

  public static views: ViewComponent[] = [Scaffold, Compact];

  public a: number;
  public b: number;

  public static seedData = data();
  public static seedMeta = seedMeta;
  public static acceptsUserData = false;

  constructor(data: ViewData[]) {
    super(data);
    this.a = data[0].a as number;
    this.b = data[0].b as number;
  }

  /** What `a` needs to make 10. */
  public get toTen(): number {
    return 10 - this.a;
  }

  public isCorrect(answer: Answer) {
    return this.a + this.b - 10 === answer;
  }

  public dataShapes() {
    return BridgeTen.dataShapes;
  }

  public views() {
    return BridgeTen.views;
  }
}
