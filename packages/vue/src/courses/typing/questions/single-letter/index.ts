// index.ts
import { Question } from '@/base-course/Displayable';
import {
  Answer,
  DataShape,
  ViewData,
  DataShapeName,
  FieldType,
  Status,
} from '@vue-skuilder/common';
import LetterQuestionView from './typeSingleLetter.vue';

const data = function () {
  const ret: { letter: string }[] = [];
  for (let i = 0; i < 26; i++) {
    ret.push({
      letter: String.fromCharCode(65 + i),
    });
  }
  return ret;
};

export class TypeLetterQuestion extends Question {
  public static dataShapes: DataShape[] = [
    {
      name: DataShapeName.TYPING_singleLetter,
      fields: [
        {
          name: 'letter',
          type: FieldType.STRING,
          validator: {
            instructions: 'Enter a single letter',
            test: function (s: string) {
              if (!s || s.length !== 1 || !/[a-zA-Z]/.test(s)) {
                return {
                  status: Status.error,
                  msg: 'Input must be a single letter',
                };
              }
              return {
                status: Status.ok,
                msg: '',
              };
            },
          },
        },
      ],
    },
  ];

  public static views = [LetterQuestionView];
  public static acceptsUserData: boolean = true;

  public letter: string;
  public static seedData = data();

  constructor(data: ViewData[]) {
    super(data);
    this.letter = data[0].letter as string;
  }

  evaluate(a: Answer, t: number) {
    return {
      isCorrect: this.isCorrect(a),
      performance: this.displayedSkill(a, t),
    };
  }

  displayedSkill(a: Answer, t: number) {
    if (this.isCorrect(a)) {
      if (t < 3000) {
        return 1.0;
      } else {
        // scale from 1 at 3s to 0.25 at 10s
        return 1 - ((t - 3000) / 7000) * 0.75;
      }
    }
    return 0;
  }

  dataShapes() {
    return TypeLetterQuestion.dataShapes;
  }

  views() {
    return TypeLetterQuestion.views;
  }

  isCorrect(a: Answer) {
    const isCorrect = (a as string).toLowerCase() === this.letter.toLowerCase();
    console.log(`singleLetter Q isCorrect: ${isCorrect}`);
    return isCorrect;
  }
}
