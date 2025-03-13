import { Answer, Question } from '../../../../base-course/Displayable';
import { FieldDefinition } from '../../../../base-course/Interfaces/FieldDefinition';
import { ViewData, DataShapeName, FieldType, Status } from '@vue-skuilder/common';
import CalculateSupplementaryAngles from './supplementaryAngles.vue';
import { randomInt } from '../../utility';

const validator = {
  instructions: 'Must be 2 or 3.',
  test: (value: string) => {
    if (value === '2' || value === '3') {
      return {
        status: Status.ok,
        msg: '',
      };
    } else {
      return {
        status: Status.error,
        msg: 'Must be 2 or 3.',
      };
    }
  },
};

const fields: FieldDefinition[] = [
  {
    name: 'AngleCount',
    type: FieldType.INT,
    validator,
  },
];

export class SupplementaryAngles extends Question {
  public static dataShapes = [
    {
      name: DataShapeName.MATH_SupplimentaryAngles,
      fields,
    },
  ];

  public static views = [CalculateSupplementaryAngles];

  public angles: number[] = [];
  public targetAngleIndex: number;
  public angleCount: number;
  public answers: string[];

  constructor(data: ViewData[]) {
    super(data);
    this.angleCount = data[0].AngleCount as number;
    let sum: number = 0;
    for (let i = 0; i <= this.angleCount - 2; i++) {
      const newAng = randomInt(25, 180 - 25 - sum);
      this.angles.push(newAng);
      sum += newAng;
    }
    this.angles.push(180 - sum);
    this.targetAngleIndex = randomInt(0, this.angleCount - 1);
  }

  public isCorrect(userAnswer: Answer) {
    return this.angles[this.targetAngleIndex] === userAnswer;
  }

  public dataShapes() {
    return SupplementaryAngles.dataShapes;
  }

  public views() {
    return SupplementaryAngles.views;
  }
}
