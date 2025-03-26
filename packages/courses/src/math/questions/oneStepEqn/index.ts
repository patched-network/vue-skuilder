import { Question } from '@vue-skuilder/common-ui';
import {
  ViewData,
  DataShapeName,
  FieldType,
  Status,
  Validator,
  FieldDefinition,
  Answer,
} from '@vue-skuilder/common';
import Solve from './solve.vue';
import { log } from '@vue-skuilder/common';

const validator = {
  instructions: 'An integer between 0 and 10, inclusive.',
  test: (value: string) => {
    const input = parseInt(value, 10);
    if (0 <= input && input <= 100) {
      return {
        status: Status.ok,
        msg: '',
      };
    } else {
      return {
        status: Status.error,
        msg: 'Single-step equation problem inputs must be between 0 and 100, inclusive.',
      };
    }
  },
};

const operationValidator: Validator = {
  test: (val: string) => {
    if (
      val === Operation.ADDITION ||
      val === Operation.SUBTRACTION ||
      val === Operation.MULTIPLICATION ||
      val === Operation.DIVISION
    ) {
      return {
        status: Status.ok,
        msg: '',
      };
    } else {
      return {
        status: Status.error,
        msg: `Operation must be ADDITION, SUBTRACTION, MULTIPLICATION, or DIVISION`,
      };
    }
  },
};

const fields: FieldDefinition[] = [
  {
    name: 'a',
    type: FieldType.INT,
    validator,
  },
  {
    name: 'b',
    type: FieldType.INT,
    validator,
  },
  {
    name: 'operation',
    type: FieldType.STRING,
    validator: operationValidator,
  },
];

enum Operation {
  ADDITION = 'ADDITION',
  SUBTRACTION = 'SUBTRACTION',
  MULTIPLICATION = 'MULTIPLICATION',
  DIVISION = 'DIVISION',
}

export class OneStepEquation extends Question {
  public static dataShapes = [
    {
      name: DataShapeName.MATH_OneStepEquation,
      fields,
    },
  ];

  public static views = [Solve];

  public a: number;
  public b: number;
  public operation: Operation;

  constructor(data: ViewData[]) {
    super(data);
    this.a = data[0].a as number;
    this.b = data[0].b as number;
    this.operation = data[0].operation as Operation;
  }

  public answer(): number {
    let answer: number = 0;

    if (this.operation === Operation.ADDITION) {
      // x - a = b
      answer = this.a + this.b;
    } else if (this.operation === Operation.SUBTRACTION) {
      // x + a = b
      answer = this.b - this.a;
    } else if (this.operation === Operation.MULTIPLICATION) {
      // x / a = b
      answer = this.a * this.b;
    } else if (this.operation === Operation.DIVISION) {
      // ax = ab
      answer = this.b;
    }

    log(
      `The answer is ${answer}
The operation is ${this.operation.valueOf()}
this.a = ${this.a}
this.b = ${this.b}
`
    );
    return answer;
  }

  public isCorrect(userAnswer: Answer) {
    return userAnswer === this.answer();
  }

  public dataShapes() {
    return OneStepEquation.dataShapes;
  }

  public views() {
    return OneStepEquation.views;
  }
}
