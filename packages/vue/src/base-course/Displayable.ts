import { DefineComponent, defineComponent } from 'vue';
import { FieldType } from '../enums/FieldType';
import { DataShape, ViewData, Answer, Evaluation } from '@vue-skuilder/common';

// [ ] #vue3 - post migration, specify this more precisely (no longer a hodge-podge)
export type ViewComponent =
  | DefineComponent<unknown, unknown, unknown>
  | ReturnType<typeof defineComponent>;

export function isDefineComponent(
  v: ViewComponent
): v is DefineComponent<unknown, unknown, unknown> {
  return (v as DefineComponent<unknown, unknown, unknown>).__isFragment !== undefined;
}

// export function isComponentOptions(v: ViewComponent): v is ComponentOptions<any> {
//   return (v as ComponentOptions<Vue>).name !== undefined;
// }

// tslint:disable-next-line:max-classes-per-file
export abstract class Displayable {
  public static dataShapes: DataShape[];

  public static views: Array<ViewComponent>;
  public static seedData?: Array<any>;
  /**
   * True if this displayable content type is meant to have
   * user-submitted questions. False if supplied seedData array
   * is comprehensive for the content type. EG, a SingleDigitAddition
   * type may comprehensively supply 0+0,0+1,...,9+9 as its seed
   * data, and not want any user input.
   */
  public static acceptsUserData: boolean = true;

  /**
   *
   */
  constructor(viewData: ViewData[]) {
    if (viewData.length === 0) {
      throw new Error(`
Displayable Constructor was called with no view Data.
            `);
    }
    validateData(this.dataShapes(), viewData);
  }

  public abstract dataShapes(): DataShape[];
  public abstract views(): Array<ViewComponent>;
}

function validateData(shape: DataShape[], data: ViewData[]) {
  for (let i = 0; i < shape.length; i++) {
    shape[i].fields.forEach((field, j) => {
      console.log(`[Displayable] shape[${i}].field[${j}]:\n ${JSON.stringify(field)}`);
      if (data[i][field.name] === undefined && field.type !== FieldType.MEDIA_UPLOADS) {
        // throw new Error(`field validation failed:\n\t${field.name}, (${field.type})`);
        console.warn(`[Displayable] missing data`);
      }
    });
  }
}

// tslint:disable-next-line:max-classes-per-file
export abstract class Question extends Displayable {
  /**
   * returns a yes/no evaluation of a user's answer. Informs the SRS
   * algorithm's decision to expand or reset a card's spacing
   * @param answer
   */
  protected abstract isCorrect(answer: Answer): boolean;
  /**
   * returns a number from [0,1] representing the user's performance on the question,
   * which informs elo adjustments and SRS multipliers
   *
   * @param answer the user's answer
   * @param timeSpent the time the user spent on the card in milliseconds
   * @returns a rating of the user's displayed skill, from 0-1
   */
  protected displayedSkill(answer: Answer, timeSpent: number): number {
    console.warn(`Question is running the reference implementation of displayedSkill.
    Consider overriding!`);
    // experts should answer this question in <= 5 secnods (5000 ms)
    const expertSpeed = 5000;
    const userSpeed = Math.min(timeSpent, 10 * expertSpeed);

    // if userResponse is > 10 x expertSpeed, discount as probably afk / distracted ?

    const speedPenalty = userSpeed / expertSpeed;
    const speedPenaltyMultiplier = userSpeed > expertSpeed ? Math.pow(0.8, speedPenalty) : 1;

    let ret = this.isCorrect(answer) ? 1 : 0;

    ret = ret * speedPenaltyMultiplier;

    return Math.min(ret, 1);
  }

  /**
   *
   * @param answer the student's answer
   * @param timeSpent the amount of time spent in ms
   * @returns
   */
  public evaluate(answer: Answer, timeSpent: number): Evaluation {
    return {
      isCorrect: this.isCorrect(answer),
      performance: this.displayedSkill(answer, timeSpent),
    };
  }

  /*
  TODO:

  This class and its interface are critical in this app - it defines the app's
  methodology, or its architecture of methodologies, for making inferences based on
  student performance.

  Some future directions:

  displayedSkill() should receive contextual data as well as the direct report of
  a user's interaction with this card. Context includes, eg, the status of the current
  study session (is the user on tilt? have there been leading Qs? have there been distractors?),
  the status of the user's interaction with the card (new? mature? history of resets?)

  displayedSkill() should reach out to a course (or just the card, or card-type?) in order to receive
  custom skill-dimension evaluators. EG: a card in the ear training course tagged 'articulation'
  could trigger a fetch of a particular evaluator fcn for articulation. In general, we
  want high-dimension evaluations.

  answers should be processed for the likelihood of non-substantive-incorrectness. eg,
  7 * 4 = 8 is much more likely to be a typo than a substantive error when compared
  with 7 * 4 = 21
  */
}
