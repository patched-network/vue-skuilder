import { Displayable, ViewComponent } from '@vue-skuilder/common-ui';
import { BlanksCard } from './default/questions/fillIn/';

export class CourseWare {
  public get questions(): Array<typeof Displayable> {
    return this.questionList;
  }

  public get allViews(): Array<ViewComponent> {
    const ret = new Array<ViewComponent>();

    this.questionList.forEach((question) => {
      question.views.forEach((view) => {
        ret.push(view);
      });
    });

    return ret;
  }

  /**
   * This function returns the map {[index:string]: string} of display
   * components needed by the CardViewer component
   */
  public get allViewsMap(): { [index: string]: ViewComponent } {
    const ret: { [index: string]: ViewComponent } = {};

    this.allViews.forEach((view) => {
      if (view.name) {
        ret[view.name] = view;
      } else {
        throw new Error('View has no name');
      }
    });

    return ret;
  }
  public readonly name: string;
  private readonly questionList: Array<typeof Displayable>;

  constructor(name: string, questionList: Array<typeof Displayable>) {
    this.name = name;
    this.questionList = questionList;

    this.questionList = this.questionList.concat(this.getBaseQTypes());
  }

  public getQuestion(name: string): typeof Displayable | undefined {
    const searchBaseName = name.replace(/^_/, '').replace(/\d+$/, '');
    const registered = this.questionList.map((q) => q.name);

    // Pass 1: exact or stripped-exact match (safe, no false positives)
    const exact = this.questionList.find((question) => {
      const questionBaseName = question.name.replace(/^_/, '').replace(/\d+$/, '');
      return question.name === name || questionBaseName === searchBaseName;
    });
    if (exact) {
      if (exact.name !== name) {
        console.debug(
          `[CourseWare.getQuestion] stripped-exact: "${name}" → "${exact.name}" (registered: ${registered.join(', ')})`,
        );
      }
      return exact;
    }

    // Pass 2: fuzzy includes() fallback for bundler name-mangling resilience.
    // Prefer the shortest-name match to avoid "GpcIntro" matching "DigraphGpcIntro".
    const fuzzyMatches = this.questionList.filter((question) => {
      const questionBaseName = question.name.replace(/^_/, '').replace(/\d+$/, '');
      return question.name.includes(searchBaseName) || name.includes(questionBaseName);
    });

    if (fuzzyMatches.length === 0) {
      console.warn(
        `[CourseWare.getQuestion] NO MATCH: "${name}" (base: "${searchBaseName}") not found in [${registered.join(', ')}]`,
      );
      return undefined;
    }

    // Among fuzzy matches, prefer the one whose name length is closest to the search name
    // (shortest delta wins). This prevents "GpcIntro" from matching "DigraphGpcIntro"
    // when "GpcIntro" itself is registered.
    fuzzyMatches.sort((a, b) =>
      Math.abs(a.name.length - name.length) - Math.abs(b.name.length - name.length)
    );
    const winner = fuzzyMatches[0];
    console.warn(
      `[CourseWare.getQuestion] FUZZY: "${name}" → "${winner.name}" (candidates: ${fuzzyMatches.map((q) => q.name).join(', ')}; registered: ${registered.join(', ')})`,
    );
    return winner;
  }

  public getBaseQTypes(): Array<typeof Displayable> {
    // #145 todo: return [BasicCard];
    // should: get 'default' course displayable types
    // return defaultCourse.getBaseQTypes();
    return [BlanksCard];
  }
}
