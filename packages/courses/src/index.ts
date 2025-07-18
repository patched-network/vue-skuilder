import { markRaw } from 'vue';
import { Course } from './Course';
import {
  Displayable,
  Question,
  ViewComponent,
} from '@vue-skuilder/common-ui';
import {
  DataShape,
  NameSpacer,
  ShapeDescriptor,
  ViewDescriptor,
  ViewData,
  Answer,
  Evaluation,
} from '@vue-skuilder/common';

// Re-export the composables with proper type constraints
export { useViewable } from '@vue-skuilder/common-ui';

// Re-export useQuestionView but with our re-exported Question type
import { useQuestionView as _useQuestionView } from '@vue-skuilder/common-ui';
export const useQuestionView = _useQuestionView as typeof _useQuestionView;


import defaultCourse from './default';

/**
 * A `Course` is a container for a set of related `Question` types.
 */
export { Course };


/**
 * The base class for all interactive course content.
 * A `Displayable` defines the data it requires and the Vue components used to render it.
 */
export { Displayable };

/**
 * The base class for all questions. It extends `Displayable` and adds
 * logic for evaluating user answers. This is the primary class developers
 * will extend to create new question types.
 */
export { Question };

/**
 * A type representing a Vue component that can be used to render a `Displayable`.
 */
export type { ViewComponent };



/**
 * Represents the actual data passed to a `Displayable`'s constructor.
 */
export type { ViewData };

/**
 * Represents a user's answer to a `Question`.
 */
export type { Answer };

/**
 * Represents the evaluation of a user's `Answer`.
 */
export type { Evaluation };

/**
 * A descriptor that uniquely identifies a `ViewComponent`.
 */
export type { ViewDescriptor };

/**
 * A descriptor that uniquely identifies a `DataShape`.
 */
export type { ShapeDescriptor };


import chess from './chess';
import french from './french';
import math from './math';
import piano from './piano';
import pitch from './pitch';
import sightSing from './sightsing';
import typing from './typing';
import wordWork from './word-work';

export { default as chess } from './chess';
export { default as french } from './french';
export { default as math } from './math';
export { default as piano } from './piano';
export { default as pitch } from './pitch';
export { default as sightSing } from './sightsing';
export { default as typing } from './typing';
export { default as wordWork } from './word-work';

export { BlanksCard, BlanksCardDataShapes } from './default/questions/fillIn';
export { default as gradeSpellingAttempt } from './default/questions/fillIn/blanksCorrection';

export {
  default as SkMidi,
  eventsToSyllableSequence,
  SyllableSequence,
  transposeSyllableSeq,
} from './piano/utility/midi';

export { default as MidiConfig } from './piano/utility/MidiConfig.vue';
export { default as SyllableSeqVis } from './piano/utility/SyllableSeqVis.vue';

export class CourseList {
  private readonly courseList: Course[];

  public get courses(): Course[] {
    return this.courseList;
  }

  constructor(courses: Course[]) {
    this.courseList = courses;
  }

  public getCourse(name: string): Course | undefined {
    return this.courseList.find((course) => {
      return course.name === name;
    });
  }

  private cachedRawViews: { [index: string]: ViewComponent } | null = null;

  public allViewsRaw(): { [index: string]: ViewComponent } {
    if (!this.cachedRawViews) {
      const av = this.allViews();
      this.cachedRawViews = Object.fromEntries(Object.entries(av).map(([k, v]) => [k, markRaw(v)]));
    }
    return this.cachedRawViews;
  }

  /**
   * allViews supplies the CardViewer component with the required
   * Vue components it needs at run-time.
   */
  public allViews(): { [index: string]: ViewComponent } {
    const ret: { [index: string]: ViewComponent } = {};

    this.courseList.forEach((course) => {
      Object.assign(ret, course.allViewsMap);
    });

    return ret;
  }

  public getView(viewDescription: ViewDescriptor | string): ViewComponent {
    let description: ViewDescriptor;
    if (typeof viewDescription === 'string') {
      description = NameSpacer.getViewDescriptor(viewDescription);
    } else {
      description = viewDescription;
    }

    const course = this.getCourse(description.course);
    if (course) {
      const question = course.getQuestion(description.questionType);
      if (question) {
        const ret = question.views.find((view) => {
          return view.name === description.view;
        });

        if (ret) {
          return ret;
        } else {
          console.error(
            `QuestionView ${description.view} not found in course ${description.course}

            descriptor: ${JSON.stringify(description)}

            course: ${course.name}
            question: ${question.name}
            views: ${question.views.map((v) => v.name).join(', ')}
            `
          );

          throw new Error(`view ${description.view} does not exist.`);
        }
      } else {
        console.error(
          `Question ${description.questionType} not found in course ${description.course}

          descriptor: ${JSON.stringify(description)}

          course: ${course.name}
          questions: ${course.questions.map((q) => q.name).join(', ')}
          `
        );
        throw new Error(`question ${description.questionType} does not exist.`);
      }
    } else {
      console.error(`Course ${description.course} not found.

        descriptor: ${JSON.stringify(description)}`);
      throw new Error(`course ${description.course} does not exist.`);
    }
  }

  /**
   * @returns a string that displays a summary of registered courses
   */
  public toString(): string {
    let ret = '';
    this.courses.forEach((c) => {
      ret += `Course: ${c.name}\n`;
      c.questions.forEach((q) => {
        ret += `  Question: ${q.name}\n`;
        q.views.forEach((v) => {
          ret += `    View: ${v.name}\n`;
        });
      });
    });
    return ret;
  }

  public allDataShapesRaw(): DataShape[] {
    const ret: DataShape[] = [];

    this.courseList.forEach((course) => {
      course.questions.forEach((question) => {
        question.dataShapes.forEach((shape) => {
          if (!ret.includes(shape)) {
            ret.push(shape);
          }
        });
      });
    });

    return ret;
  }

  public allDataShapes(): (ShapeDescriptor & { displayable: typeof Displayable })[] {
    const ret: (ShapeDescriptor & { displayable: typeof Displayable })[] = [];

    this.courseList.forEach((course) => {
      course.questions.forEach((question) => {
        question.dataShapes.forEach((shape) => {
          // [ ] need to de-dup shapes here. Currently, if a shape is used in multiple courses
          //     it will be returned multiple times.
          //     `Blanks` shape is is hard coded into new courses, so gets returned many times
          if (
            ret.findIndex((testShape) => {
              return testShape.course === course.name && testShape.dataShape === shape.name;
            }) === -1
          ) {
            ret.push({
              course: course.name,
              dataShape: shape.name,
              displayable: question,
            });
          }
        });
      });
    });

    return ret;
  }

  public getDataShape(description: ShapeDescriptor): DataShape {
    let ret: DataShape | undefined;

    this.getCourse(description.course)!.questions.forEach((question) => {
      question.dataShapes.forEach((shape) => {
        if (shape.name === description.dataShape) {
          ret = shape;
        }
      });
    });

    if (ret) {
      return ret;
    } else {
      throw new Error(`DataShape ${NameSpacer.getDataShapeString(description)} not found`);
    }
  }
}

export const allCourses: CourseList = new CourseList([
  math,
  wordWork,
  french,
  defaultCourse,
  piano,
  pitch,
  sightSing,
  chess,
  typing,
]);
