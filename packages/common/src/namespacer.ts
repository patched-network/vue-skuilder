export class NameSpacer {
  public static getDataShapeDescriptor(shapeStr: string): ShapeDescriptor {
    const splitArray = shapeStr.split('.');

    if (splitArray.length !== 3) {
      throw new Error('shapeStr not valid');
    } else {
      return {
        course: splitArray[0],
        dataShape: splitArray[2],
      };
    }
  }
  public static getDataShapeString(shapeDescription: ShapeDescriptor): string {
    return `${shapeDescription.course}.datashape.${shapeDescription.dataShape}`;
  }

  public static getViewDescriptor(viewStr: string): ViewDescriptor {
    const splitArray = viewStr.split('.');

    if (splitArray.length !== 4) {
      throw new Error('viewStr not valid');
    } else {
      return {
        course: splitArray[0],
        questionType: splitArray[2],
        view: splitArray[3],
      };
    }
  }

  public static getViewString(viewDescription: ViewDescriptor): string {
    return (
      `${viewDescription.course}.question.` +
      `${viewDescription.questionType}.${viewDescription.view}`
    );
  }

  public static getQuestionDescriptor(questionStr: string): QuestionDescriptor {
    const splitArray = questionStr.split('.');

    if (splitArray.length !== 3) {
      throw new Error('questionStr not valid');
    } else {
      return {
        course: splitArray[0],
        questionType: splitArray[2],
      };
    }
  }

  public static getQuestionString(questionDescription: QuestionDescriptor): string {
    return `${questionDescription.course}.question.${questionDescription.questionType}`;
  }
}

export interface ShapeDescriptor {
  course: string;
  dataShape: string;
}

export interface QuestionDescriptor {
  course: string;
  questionType: string;
}

export interface ViewDescriptor {
  course: string;
  questionType: string;
  view: string;
}
