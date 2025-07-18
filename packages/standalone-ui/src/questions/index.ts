// Library entry point for custom questions in standalone-ui
// This file exports question types and components for consumption by studio-ui

import { Course } from '@vue-skuilder/courses';
import { DataShape } from '@vue-skuilder/common';
import { ViewComponent } from '@vue-skuilder/common-ui';

// [ ] todo: simplify exports here. Only the final 'bundle' is strictly required.

// Export individual question classes
export { SimpleTextQuestion } from './SimpleTextQuestion';
export { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
export { NumberRangeQuestion } from './NumberRangeQuestion';

// Export example course
export { exampleCourse } from './exampleCourse';

// Import components for re-export
import SimpleTextQuestionView from './SimpleTextQuestionView.vue';
import MultipleChoiceQuestionView from './MultipleChoiceQuestionView.vue';
import NumberRangeQuestionView from './NumberRangeQuestionView.vue';

// Export Vue components
export { SimpleTextQuestionView, MultipleChoiceQuestionView, NumberRangeQuestionView };

// Import classes for analysis
import { SimpleTextQuestion } from './SimpleTextQuestion';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { NumberRangeQuestion } from './NumberRangeQuestion';
import { exampleCourse } from './exampleCourse';

/**
 * Main function to export all custom questions for studio-ui consumption
 * This provides a standardized interface for the CLI to discover and integrate
 * custom question types into studio-ui builds
 */
export function allCustomQuestions() {
  // Collect all question classes
  const questionClasses = [SimpleTextQuestion, MultipleChoiceQuestion, NumberRangeQuestion];

  // Collect all data shapes from questions
  const dataShapes: DataShape[] = [];
  questionClasses.forEach((questionClass) => {
    if (questionClass.dataShapes) {
      questionClass.dataShapes.forEach((shape) => {
        // Avoid duplicates
        if (!dataShapes.find((existing) => existing.name === shape.name)) {
          dataShapes.push(shape);
        }
      });
    }
  });

  // Collect all view components from questions
  const views: ViewComponent[] = [];
  questionClasses.forEach((questionClass) => {
    if (questionClass.views) {
      questionClass.views.forEach((view) => {
        // Avoid duplicates by name
        if (!views.find((existing) => existing.name === view.name)) {
          views.push(view);
        }
      });
    }
  });

  const courses = [exampleCourse];

  // Return structured data for studio-ui integration
  return {
    // Course instances with question instances
    courses,

    // Question class constructors for registration
    questionClasses,

    // Available data shapes for studio-ui CreateCardView
    dataShapes,

    // Vue components for runtime registration
    views,

    // Metadata for debugging and analysis
    meta: {
      questionCount: questionClasses.length,
      dataShapeCount: dataShapes.length,
      viewCount: views.length,
      courseCount: courses.length,
      packageName: '@vue-skuilder/standalone-ui',
      sourceDirectory: 'src/questions',
    },
  };
}

/**
 * Type definitions for the custom questions export structure
 * This provides TypeScript support for CLI and studio-ui integration
 */
export interface CustomQuestionsExport {
  courses: Course[];
  questionClasses: Array<
    typeof SimpleTextQuestion | typeof MultipleChoiceQuestion | typeof NumberRangeQuestion
  >;
  dataShapes: DataShape[];
  views: ViewComponent[];
  meta: {
    questionCount: number;
    dataShapeCount: number;
    viewCount: number;
    courseCount: number;
    packageName: string;
    sourceDirectory: string;
  };
}

// Default export for convenience
export default allCustomQuestions;
