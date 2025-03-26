import { Question } from '@vue-skuilder/common-ui';
import { DataShapeName, Answer, FieldType, ViewData } from '@vue-skuilder/common';
import AudioParseView from './view.vue';
import { DataShape, Status } from '@vue-skuilder/common';

export class AudioParsingQuestion extends Question {
  public static dataShapes: DataShape[] = [
    {
      name: DataShapeName.FRENCH_AudioParse,
      fields: [
        {
          name: 'audio',
          type: FieldType.IMAGE,
        },
        {
          name: 'text',
          type: FieldType.STRING,
          validator: {
            test: (value: string) => {
              const good = value.length < 45;
              return {
                msg: good ? '' : "It's too long!",
                status: good ? Status.ok : Status.error,
              };
            },
          },
        },
      ],
    },
  ];
  public static views = [AudioParseView];

  public audio: Blob;
  public text: string;

  constructor(data: ViewData[]) {
    super(data);
    this.audio = data[0].audio as Blob;
    this.text = data[0].text as string;
  }

  public isCorrect(answer: Answer): boolean {
    throw new Error(`isCorrect() not implemented - cannor parse ${answer}`);
  }

  public dataShapes() {
    return AudioParsingQuestion.dataShapes;
  }
  public views() {
    return AudioParsingQuestion.views;
  }
}
