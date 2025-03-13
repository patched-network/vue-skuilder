import { Question } from '../../../../base-course/Displayable';
import {
  DataShapeName,
  FieldType,
  Validators,
  DataShape,
  Answer,
  FieldDefinition,
  ViewData,
} from '@vue-skuilder/common';
import TextBox from './textBox.vue';

const fields: FieldDefinition[] = [
  {
    name: 'Word',
    type: FieldType.STRING,
    validator: Validators.NonEmptyString,
  },
  {
    name: 'ExampleSentence',
    type: FieldType.STRING,
  },
  {
    name: 'WordAudio',
    type: FieldType.AUDIO,
  },
  {
    name: 'SentenceAudio',
    type: FieldType.AUDIO,
  },
];

export class SpellingQuestion extends Question {
  public static dataShapes: DataShape[] = [
    {
      fields,
      name: DataShapeName.WORDWORK_Spelling,
    },
  ];

  public static views = [TextBox];

  public word: string;
  public sentence: string;
  public audio_word: Blob;
  public audio_sentence: Blob;

  constructor(data: ViewData[]) {
    super(data);
    this.word = data[0].Word as string;
    this.sentence = data[0].Sentence as string;
    this.audio_word = data[0].WordAudio as Blob;
    this.audio_sentence = data[0].SentenceAudio as Blob;
  }

  public isCorrect(answer: Answer): boolean {
    return answer === this.word;
  }
  public dataShapes(): DataShape[] {
    return SpellingQuestion.dataShapes;
  }
  public views() {
    return SpellingQuestion.views;
  }
}
