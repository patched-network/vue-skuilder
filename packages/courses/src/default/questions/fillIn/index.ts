import { Question, splitByDelimiters, containsComponent } from '@vue-skuilder/common-ui';
import { Answer, RadioMultipleChoiceAnswer, DataShape } from '@vue-skuilder/common';
import { Validator, ViewData } from '@vue-skuilder/common';
import { randomInt } from '@/math/utility';
import { FieldType, DataShapeName, Status } from '@vue-skuilder/common';
import _ from 'lodash';
import { Tokens } from 'marked';
import FillInView from './fillIn.vue';

export const BlanksCardDataShapes: DataShape[] = [
  {
    name: DataShapeName.Blanks,
    fields: [
      {
        name: 'Input',
        type: FieldType.MARKDOWN,
      },
      {
        name: 'Uploads',
        type: FieldType.MEDIA_UPLOADS,
      },
    ],
  },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-expect-error
const val: Validator = {
  test: (input) => {
    console.log(`Testing md input: ${input}`);
    // const sections = parseBlanksMarkdown(input);
    // let blanksCount: number = 0;
    // sections.forEach((section) => {
    //   if (section.type === 'blank') {
    //     blanksCount++;
    //   }
    // });

    // if (blanksCount === 1) {
    return {
      status: Status.ok,
      msg: '',
    };
    // } else {
    //   return {
    //     status: Status.error,
    //     msg: 'There must be exactly one blank of the form {{answer}} in the question'
    //   };
    // }
  },
};

type fillInSectionType = 'text' | 'blank';

export interface FillInSection {
  type: fillInSectionType;
  text: string;
}

function splitText(
  text: string,
  leftBound: string,
  rightBound: string
): {
  left: string;
  middle: string;
  right: string;
} {
  const leftSplit = text.split(leftBound);
  const left = leftSplit[0];

  const rightSplit = leftSplit[1].split(rightBound);
  const middle = rightSplit[0];
  const right = rightSplit[1];

  return { left, middle, right };
}

export class BlanksCard extends Question {
  public static dataShapes = BlanksCardDataShapes;
  public static views = [FillInView];
  public mdText: string = '';

  public answers: string[] | null = null;
  public options: string[] | null = null;

  public splitTextToken(token: Tokens.Text): Tokens.Text[] {
    if (containsComponent(token)) {
      const text = splitText(token.text, '{{', '}}');
      const raw = splitText(token.raw, '{{', '}}');

      const ret: Tokens.Text[] = [];

      if (raw.left.length > 0) {
        ret.push({
          type: 'text',
          raw: raw.left,
          text: text.left,
        });
      }
      if (raw.middle.length > 0) {
        ret.push({
          type: 'text',
          raw: '{{' + raw.middle + '}}',
          text: '{{' + text.middle + '}}',
        });
      }
      if (raw.right.length > 0) {
        ret.push({
          type: 'text',
          raw: raw.right,
          text: text.right,
        });
      }

      return ret;
    } else {
      return [token];
    }
  }

  /**
   * Parses a string to extract answer options and distractors for a fill-in question.
   * The input string must be wrapped in curly braces and can contain multiple answers/distractors separated by | and ||.
   * For example: "{{answer1|answer2||distractor1|distractor2}}"
   * @param s The input string containing answers and optional distractors
   * @returns An object containing the parsed answers array and shuffled options array (or null if no distractors)
   * @throws Error if input string is not properly formatted with {{ }}
   */
  private optionsFromString(s: string) {
    if (!s.startsWith('{{') || !s.endsWith('}}')) {
      throw new Error(`string ${s} is not fill-in text - must look like "{{someText}}"`);
    }
    s = s.substring(2, s.length - 2);
    const split = s.split('||');
    if (split.length > 1) {
      const answers = split[0].split('|').map((a) => a.trim());
      // remove answers from distractors (makes for easier editing to allow answers in the distractor list)
      const distractors = split[1]
        .split('|')
        .map((d) => d.trim())
        .filter((d) => !answers.includes(d));

      const options = distractors;
      options.push(answers[randomInt(0, answers.length - 1)]);

      return {
        answers,
        options: _.shuffle(options),
      };
    } else {
      return {
        answers: [s.trim()],
        options: null,
      };
    }
  }

  constructor(data: ViewData[]) {
    super(data);
    this.mdText = data[0].Input as unknown as string;
    if (this.mdText === undefined) {
      this.mdText = '';
    }

    const splits = splitByDelimiters(this.mdText, '{{', '}}');
    const recombines = [];
    for (let i = 0; i < splits.length; i++) {
      try {
        const parsedOptions = this.optionsFromString(splits[i]);
        this.answers = parsedOptions.answers;
        this.options = parsedOptions.options;
        if (this.options?.length) {
          recombines.push('{{ || }}'); // render a multiple-choice blank
        } else {
          recombines.push('{{ }}'); // render a fill-in blank
        }
      } catch {
        recombines.push(splits[i]);
      }
    }
    this.mdText = recombines.join('');
  }

  public isCorrect(answer: Answer) {
    console.log(`answers:${this.answers}\nuser answer: ${JSON.stringify(answer)}`);

    if (typeof answer === 'string') {
      if (this.answers) {
        return this.answers.includes(answer);
      } else {
        if (answer === '') {
          return true;
        } else {
          throw new Error(`Question has no configured answers!`);
        }
      }
    } else if (Array.isArray(answer)) {
      if (this.answers) {
        return answer.every((a) => {
          return this.answers!.includes(a);
        });
      } else {
        throw new Error(`Question has no configured answers!`);
      }
    } else {
      return this.isCorrectRadio(answer as RadioMultipleChoiceAnswer);
    }
  }

  public dataShapes() {
    return BlanksCard.dataShapes;
  }
  public views() {
    return BlanksCard.views;
  }

  private isCorrectRadio(answer: RadioMultipleChoiceAnswer) {
    if (this.answers) {
      return this.answers.includes(answer.choiceList[answer.selection]);
    } else {
      return false;
    }
  }
}
