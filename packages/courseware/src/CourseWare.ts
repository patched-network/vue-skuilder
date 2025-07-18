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
    return this.questionList.find((question) => {
      // Extract base name without potential prefix/suffix
      const questionBaseName = question.name.replace(/^_/, '').replace(/\d+$/, '');
      const searchBaseName = name.replace(/^_/, '').replace(/\d+$/, '');

      return (
        // Exact match
        question.name === name ||
        // Match with different prefix/suffix combinations
        questionBaseName === searchBaseName ||
        // Original fallback for partial matches
        question.name.includes(searchBaseName) ||
        name.includes(questionBaseName)
      );
    });
  }

  public getBaseQTypes(): Array<typeof Displayable> {
    // #145 todo: return [BasicCard];
    // should: get 'default' course displayable types
    // return defaultCourse.getBaseQTypes();
    return [BlanksCard];
  }
}
