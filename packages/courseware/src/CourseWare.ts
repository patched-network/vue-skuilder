import { Displayable, ViewComponent } from '@vue-skuilder/common-ui';

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

  constructor(name: string, questionList: Array<typeof Displayable>, baseTypes?: Array<typeof Displayable>) {
    this.name = name;
    this.questionList = baseTypes ? questionList.concat(baseTypes) : questionList;
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

  /**
   * Inject shared question types (e.g. BlanksCard) into this course.
   * Called by AllCourseWare after construction to avoid circular imports.
   */
  public injectBaseTypes(types: Array<typeof Displayable>): void {
    for (const t of types) {
      if (!this.questionList.includes(t)) {
        this.questionList.push(t);
      }
    }
  }
}