import { Question, ViewComponent } from '@vue-skuilder/common-ui';
import { Answer, SeedMeta, ViewData } from '@vue-skuilder/common';
import Horizontal from './horizontal.vue';
import { DecadeFactDataShape } from './shapes.js';

export enum DecadeOp {
  ADD = 'ADD',
  SUB = 'SUB',
}

type DecadeItem = { a: number; b: number; op: DecadeOp };

/**
 * Single-digit facts scaled by ten: 40 + 30 from 4 + 3, 120 - 50 from 12 - 5.
 * Every x + y with x, y in 10..90, and its inverse (x + y) - x.
 */
const data = function () {
  const ret: DecadeItem[] = [];
  for (let x = 10; x <= 90; x += 10) {
    for (let y = 10; y <= 90; y += 10) {
      ret.push({ a: x, b: y, op: DecadeOp.ADD });
      ret.push({ a: x + y, b: x, op: DecadeOp.SUB });
    }
  }
  return ret;
};

const seedMeta = (item: unknown): SeedMeta => {
  const { a, b, op } = item as DecadeItem;
  const crosses100 = op === DecadeOp.ADD ? a + b > 100 : a > 100;
  const tags = ['decade-fact', op === DecadeOp.ADD ? 'decade-add' : 'decade-sub'];
  if (crosses100) {
    tags.push('cross-100');
  }
  return {
    tags,
    elo: 1200 + (op === DecadeOp.SUB ? 50 : 0) + (crosses100 ? 75 : 0),
  };
};

export class DecadeFact extends Question {
  public static dataShapes = [DecadeFactDataShape];

  public static views: ViewComponent[] = [Horizontal];

  public a: number;
  public b: number;
  public op: DecadeOp;

  public static seedData = data();
  public static seedMeta = seedMeta;
  public static acceptsUserData = false;

  constructor(data: ViewData[]) {
    super(data);
    this.a = data[0].a as number;
    this.b = data[0].b as number;
    this.op = data[0].op as DecadeOp;
  }

  public get symbol(): string {
    return this.op === DecadeOp.ADD ? '+' : '−';
  }

  public isCorrect(answer: Answer) {
    const expected = this.op === DecadeOp.ADD ? this.a + this.b : this.a - this.b;
    return expected === answer;
  }

  public dataShapes() {
    return DecadeFact.dataShapes;
  }

  public views() {
    return DecadeFact.views;
  }
}
