import { Question, ViewComponent } from '@vue-skuilder/common-ui';
import { Answer, ViewData } from '@vue-skuilder/common';
import HorizontalAddition from './horizontal.vue';
import VerbalAddition from './verbal.vue';
import { SingleDigitAdditionDataShape } from './shapes.js';

const data = function () {
  const ret: { a: number; b: number }[] = [];
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      ret.push({
        a: i,
        b: j,
      });
    }
  }
  return ret;
};

export class SingleDigitAdditionQuestion extends Question {
  public static dataShapes = [SingleDigitAdditionDataShape];

  public static views: ViewComponent[] = [HorizontalAddition, VerbalAddition];

  public a: number;
  public b: number;

  public static seedData = data();
  public static acceptsUserData = false;

  constructor(data: ViewData[]) {
    super(data);
    this.a = data[0].a as number;
    this.b = data[0].b as number;
  }

  public isCorrect(answer: Answer) {
    return 1 * this.a + this.b === answer;
  }

  public dataShapes() {
    return SingleDigitAdditionQuestion.dataShapes;
  }

  public views() {
    return SingleDigitAdditionQuestion.views;
  }
}
