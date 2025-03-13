// vue/src/courses/typing/questions/falling-letters/index.ts
import { Question } from '@/base-course/Displayable';
import {
  Answer,
  DataShape,
  DataShapeName,
  FieldType,
  Status,
  ViewData,
} from '@vue-skuilder/common';
import FallingLettersView from './FallingLetters.vue';

const data = function () {
  return [
    {
      gameLength: 30, // 30 seconds game
      initialSpeed: 2, // Initial fall speed
      acceleration: 0.1, // Speed increase per second
      spawnInterval: 1, // New letter every second
    },
  ];
};

export interface Score extends Answer {
  win: boolean;
  lettersTyped: number;
  // the percentage of the gameLength that the user was able to complete
  // (0-1)
  percentage: number;
}

export class FallingLettersQuestion extends Question {
  public static dataShapes: DataShape[] = [
    {
      name: DataShapeName.TYPING_fallingLetters,
      fields: [
        {
          name: 'gameLength',
          type: FieldType.NUMBER,
        },
        {
          name: 'initialSpeed',
          type: FieldType.NUMBER,
        },
        {
          name: 'acceleration',
          type: FieldType.NUMBER,
        },
        {
          name: 'spawnInterval',
          type: FieldType.NUMBER,
          validator: {
            instructions: 'How often should a new letter spawn? (in seconds)',
            test: (input: unknown) => {
              if (typeof input === 'string') {
                const x = parseFloat(input);
                if (x > 0) {
                  return { status: Status.ok, msg: '' };
                } else {
                  return { status: Status.error, msg: 'Must be greater than 0' };
                }
              } else {
                return { status: Status.error, msg: 'Unexpected non-string input.' };
              }
            },
            placeholder: '1',
          },
        },
      ],
    },
  ];

  public static views = [FallingLettersView];
  public static acceptsUserData: boolean = true;
  public static seedData = data();

  public gameLength: number;
  public initialSpeed: number;
  public acceleration: number;
  public spawnInterval: number;

  constructor(data: ViewData[]) {
    super(data);
    this.gameLength = data[0].gameLength as number;
    this.initialSpeed = data[0].initialSpeed as number;
    this.acceleration = data[0].acceleration as number;
    this.spawnInterval = data[0].spawnInterval as number;
  }

  evaluate(a: Answer, t: number) {
    return {
      isCorrect: this.isCorrect(a as Score),
      performance: this.displayedSkill(a as Score, t),
    };
  }

  displayedSkill(a: Answer) {
    if ((a as Score).win) {
      return 1;
    } else {
      return (a as Score).percentage;
    }
  }

  dataShapes() {
    return FallingLettersQuestion.dataShapes;
  }

  views() {
    return FallingLettersQuestion.views;
  }

  isCorrect(a: Score) {
    return a.win;
  }
}
