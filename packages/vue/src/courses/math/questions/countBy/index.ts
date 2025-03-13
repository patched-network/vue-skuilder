import { Answer, Question } from '../../../../base-course/Displayable';
import { FieldDefinition, ViewData, DataShapeName, FieldType, Status } from '@vue-skuilder/common';
import defaultView from './default.vue';

interface A extends Answer {
  [index: number]: number;
}
enum Hands {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

const fields: FieldDefinition[] = [
  {
    name: 'n',
    type: FieldType.INT,
  },
  {
    name: 'hand',
    type: FieldType.STRING,
    validator: {
      test: (h) => {
        if (h === Hands.LEFT || h === Hands.RIGHT) {
          return {
            status: Status.ok,
            msg: '',
          };
        } else {
          return {
            status: Status.error,
            msg: `Hand must be ${Hands.LEFT} or ${Hands.RIGHT}`,
          };
        }
      },
    },
  },
];

const data = function () {
  const ret: { n: number; hand: Hands }[] = [];
  for (let i = 2; i <= 10; i++) {
    ret.push({ n: i, hand: Hands.LEFT });
    ret.push({ n: i, hand: Hands.RIGHT });
  }
  return ret;
};

function asInt(n: number | string): number {
  if (typeof n === 'string') {
    return parseInt(n);
  } else {
    return n;
  }
}

export class CountBy extends Question {
  public static dataShapes = [
    {
      name: DataShapeName.MATH_CountBy,
      fields,
    },
  ];

  public static views = [defaultView];

  public n: number;
  public hand: Hands;

  public static seedData = data();
  public static acceptsUserData = false;

  constructor(data: ViewData[]) {
    super(data);
    this.n = data[0].n as number;
    this.hand = data[0].hand as Hands;
  }

  public get answer(): number[] {
    const soln: number[] = [];
    const start: number = this.hand === Hands.LEFT ? this.n : 6 * this.n;
    for (let i = 0; i < 5; i++) {
      soln.push(start + i * this.n);
    }
    return soln;
  }

  public isCorrect(answer: A) {
    console.log(`Solution: ${this.answer.toString()}`);

    for (let i = 0; i < this.answer.length; i++) {
      if (asInt(answer[i]) !== this.answer[i]) {
        console.log(`answer[${i}] == ${answer[i]} !== ${this.answer[i]}`);

        return false;
      }
    }

    return true;
  }

  public dataShapes() {
    return CountBy.dataShapes;
  }

  public views() {
    return CountBy.views;
  }
}
