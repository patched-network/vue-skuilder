import { Question } from '@vue-skuilder/common-ui';
import { DataShape, FieldDefinition } from '@vue-skuilder/common';
import { ViewData, DataShapeName, FieldType, Status, Answer } from '@vue-skuilder/common';
import TextBox from './textBox.vue';
import _ from 'lodash';

enum Chroma {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
  G = 'G',
}

const fields: FieldDefinition[] = [
  {
    name: 'Chroma',
    type: FieldType.STRING,
    validator: {
      test: (value) => {
        // Check if the value is a valid Chroma enum value
        if (Object.values(Chroma).includes(value as Chroma)) {
          return {
            status: Status.ok,
            msg: '',
          };
        }
        return {
          status: Status.error,
          msg: "That's not a chroma!",
        };
      },
      instructions: 'Enter a valid musical note (A-G)',
    },
  },
];

export class ChromaQuestion extends Question {
  public static dataShapes: DataShape[] = [
    {
      fields,
      name: DataShapeName.PITCH_chroma,
    },
  ];

  public static views = [TextBox];

  public chroma: Chroma;

  constructor(data: ViewData[]) {
    super(data);

    this.chroma = data[0].Chroma as Chroma;
  }
  public get baseFreq(): number {
    const aFreq = 440;

    if (this.chroma === 'A') return aFreq;
    else if (this.chroma === 'B') return aFreq * Math.pow(2, 2 / 12);
    else if (this.chroma === 'C') {
      return aFreq * Math.pow(2, 3 / 12);
    }

    return aFreq;
  }

  public get choiceList(): string[] {
    return _.shuffle([this.chroma.toString(), 'test', 'options', 'are', 'fun']);
  }

  public isCorrect(answer: Answer): boolean {
    // alert(JSON.stringify(answer));
    return (answer as any).choiceList[(answer as any).selection] === this.chroma.toString();
  }
  public dataShapes(): DataShape[] {
    return ChromaQuestion.dataShapes;
  }
  public views() {
    return ChromaQuestion.views;
  }
}
