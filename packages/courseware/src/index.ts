import { markRaw } from 'vue';
import { CourseWare } from './CourseWare';
import { Displayable, Question, ViewComponent } from '@vue-skuilder/common-ui';
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

// `defaultCourse` (the built-in "spelling" course based on BlanksCard) is no
// longer eagerly registered with `allCourseWare`. Consumers that need it must
// import and register it explicitly:
//
//   import { allCourseWare, defaultCourse } from '@vue-skuilder/courseware';
//   allCourseWare.courses.push(defaultCourse);
//
// This keeps the `BlanksCard` machinery (which pulls in MarkdownRenderer +
// markdown-it) out of the bundles of consumers that don't render BlanksCard
// content (e.g. LettersPractice, which uses entirely custom inline cards).
export { default as defaultCourse } from './default';

/**
 * A `CourseWare` is a container for a set of related `Question` types.
 */
export { CourseWare };

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

// Subcourses are no longer eagerly imported here. Previously, `allCourseWare`
// was constructed with all subcourses inlined, which forced every consumer
// (regardless of which courses it actually uses) to ship chess, piano, math,
// pitch, etc. in its bundle (~200-300 KB gzip dead weight for consumers like
// LettersPractice that don't use any of them).
//
// Subcourses remain available via:
//   - Named static import:  `import { chess } from '@vue-skuilder/courseware'`
//     (consumers that don't reference these names will tree-shake them out.)
//   - Async loader:         `import('@vue-skuilder/courseware/chess')` style not
//     yet supported via subpath exports; consumers register a specific subcourse
//     by calling `loadSubcourse('chess')` or via the convenience
//     `loadAllSubcourses()` (returns a Promise).
//
// `allCourseWare` now starts empty. Consumers that previously depended on
// `allCourseWare` being fully populated (e.g. platform-ui) must explicitly
// register the subcourses (and `defaultCourse`) they need.
export { default as chess } from './chess';
export { default as french } from './french';
export { default as math } from './math';
export { default as piano } from './piano';
export { default as pitch } from './pitch';
export { default as sightSing } from './sightsing';
export { default as typing } from './typing';
export { default as wordWork } from './word-work';

/**
 * Name of a built-in subcourse that can be lazily loaded.
 */
export type SubcourseName =
  | 'chess'
  | 'french'
  | 'math'
  | 'piano'
  | 'pitch'
  | 'sightSing'
  | 'typing'
  | 'wordWork';

/**
 * Lazily load a single built-in subcourse and register it with `allCourseWare`.
 *
 * Dynamic imports are inlined in the function body (rather than held in a
 * top-level table) so Rollup can statically prove the function is dead code
 * when consumers don't reference it — enabling tree-shaking of every
 * subcourse module the app doesn't need.
 *
 * No-op if the subcourse is already registered (by name).
 */
export async function loadSubcourse(name: SubcourseName): Promise<CourseWare> {
  let mod: { default: CourseWare };
  switch (name) {
    case 'chess': mod = await import('./chess'); break;
    case 'french': mod = await import('./french'); break;
    case 'math': mod = await import('./math'); break;
    case 'piano': mod = await import('./piano'); break;
    case 'pitch': mod = await import('./pitch'); break;
    case 'sightSing': mod = await import('./sightsing'); break;
    case 'typing': mod = await import('./typing'); break;
    case 'wordWork': mod = await import('./word-work'); break;
  }
  const cw = mod.default;
  if (!allCourseWare.courses.find((existing) => existing.name === cw.name)) {
    allCourseWare.courses.push(cw);
  }
  return cw;
}

/**
 * Lazily load and register all built-in subcourses. Use this in consumers
 * (e.g. platform-ui) that historically depended on `allCourseWare` being
 * fully pre-populated. Consumers that only need specific subcourses should
 * prefer `loadSubcourse(name)` instead.
 */
export async function loadAllSubcourses(): Promise<void> {
  const names: SubcourseName[] = [
    'chess', 'french', 'math', 'piano', 'pitch', 'sightSing', 'typing', 'wordWork',
  ];
  await Promise.all(names.map((n) => loadSubcourse(n)));
}

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

export class AllCourseWare {
  private readonly courseWareList: CourseWare[];

  public get courses(): CourseWare[] {
    return this.courseWareList;
  }

  constructor(courses: CourseWare[]) {
    this.courseWareList = courses;
  }

  public getCourseWare(name: string): CourseWare | undefined {
    return this.courseWareList.find((course) => {
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

    this.courseWareList.forEach((cw) => {
      Object.assign(ret, cw.allViewsMap);
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

    const course = this.getCourseWare(description.course);
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

    this.courseWareList.forEach((cw) => {
      cw.questions.forEach((question) => {
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

    this.courseWareList.forEach((cw) => {
      cw.questions.forEach((question) => {
        question.dataShapes.forEach((shape) => {
          // [ ] need to de-dup shapes here. Currently, if a shape is used in multiple courses
          //     it will be returned multiple times.
          //     `Blanks` shape is is hard coded into new courses, so gets returned many times
          if (
            ret.findIndex((testShape) => {
              return testShape.course === cw.name && testShape.dataShape === shape.name;
            }) === -1
          ) {
            ret.push({
              course: cw.name,
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

    this.getCourseWare(description.course)!.questions.forEach((question) => {
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

// Starts empty. All built-in courses (including `defaultCourse`, chess, piano,
// math, pitch, etc.) must be explicitly registered by the consumer:
//
//   // Eager registration of a specific built-in course:
//   import { allCourseWare, defaultCourse } from '@vue-skuilder/courseware';
//   allCourseWare.courses.push(defaultCourse);
//
//   // Or lazy registration:
//   import { loadSubcourse } from '@vue-skuilder/courseware';
//   await loadSubcourse('pitch');
//
// This keeps consumers from paying the bundle cost of subcourses they don't
// use. The previous pre-populated default was convenient for prototyping but
// silently bloated production bundles with chess/piano/math/sightsing/etc.
export const allCourseWare: AllCourseWare = new AllCourseWare([]);
