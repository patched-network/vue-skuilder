import { CourseConfig, DataShape, NameSpacer } from '@vue-skuilder/common';
import { CourseDBInterface } from '@vue-skuilder/db';
import { Displayable, getCurrentUser, ViewComponent } from '@vue-skuilder/common-ui';
import { Course } from '@vue-skuilder/courses';

/**
 * Interface for custom questions data structure returned by allCustomQuestions()
 */
export interface CustomQuestionsData {
  courses: Course[]; // Course instances with question instances
  questionClasses: Displayable[]; // Question class constructors
  dataShapes: DataShape[]; // DataShape definitions for studio-ui
  views: ViewComponent[]; // Vue components for rendering
  meta: {
    questionCount: number;
    dataShapeCount: number;
    viewCount: number;
    courseCount: number;
    packageName: string;
    sourceDirectory: string;
  };
}

/**
 * Interface for processed question data for registration
 */
export interface ProcessedQuestionData {
  name: string;
  course: string;
  questionClass: any;
  dataShapes: any[];
  views: any[];
}

/**
 * Interface for processed data shape for registration
 */
export interface ProcessedDataShape {
  name: string;
  course: string;
  dataShape: any;
}

/**
 * Check if a data shape is already registered in the course config
 */
export function isDataShapeRegistered(
  dataShape: ProcessedDataShape,
  courseConfig: CourseConfig
): boolean {
  const namespacedName = NameSpacer.getDataShapeString({
    dataShape: dataShape.name,
    course: dataShape.course,
  });

  return courseConfig.dataShapes.some((ds) => ds.name === namespacedName);
}

/**
 * Check if a question type is already registered in the course config
 */
export function isQuestionTypeRegistered(
  question: ProcessedQuestionData,
  courseConfig: CourseConfig
): boolean {
  const namespacedName = NameSpacer.getQuestionString({
    course: question.course,
    questionType: question.name,
  });

  return courseConfig.questionTypes.some((qt) => qt.name === namespacedName);
}

/**
 * Process custom questions data into registration-ready format
 */
export function processCustomQuestionsData(customQuestions: CustomQuestionsData): {
  dataShapes: ProcessedDataShape[];
  questions: ProcessedQuestionData[];
} {
  const processedDataShapes: ProcessedDataShape[] = [];
  const processedQuestions: ProcessedQuestionData[] = [];

  // Extract course names from the custom questions
  const courseNames = customQuestions.courses.map((course) => course.name);

  // Process each question class
  customQuestions.questionClasses.forEach((questionClass) => {
    // Determine the course name (use first course or default to meta.packageName)
    const courseName = courseNames.length > 0 ? courseNames[0] : customQuestions.meta.packageName;

    // Process data shapes from this question class
    if (questionClass.dataShapes && Array.isArray(questionClass.dataShapes)) {
      questionClass.dataShapes().forEach((dataShape) => {
        processedDataShapes.push({
          name: dataShape.name,
          course: courseName,
          dataShape: dataShape,
        });
      });
    }

    // Process the question itself
    processedQuestions.push({
      name: questionClass.constructor.name,
      course: courseName,
      questionClass: questionClass,
      dataShapes: questionClass.dataShapes() || [],
      views: questionClass.views() || [],
    });
  });

  return { dataShapes: processedDataShapes, questions: processedQuestions };
}

/**
 * Register a data shape in the course config
 */
export function registerDataShape(
  dataShape: ProcessedDataShape,
  courseConfig: CourseConfig
): boolean {
  if (isDataShapeRegistered(dataShape, courseConfig)) {
    console.log(
      `   ℹ️  DataShape '${dataShape.name}' from '${dataShape.course}' already registered`
    );
    return false;
  }

  const namespacedName = NameSpacer.getDataShapeString({
    dataShape: dataShape.name,
    course: dataShape.course,
  });

  courseConfig.dataShapes.push({
    name: namespacedName,
    questionTypes: [],
  });

  console.log(`   ✅ Registered DataShape: ${namespacedName}`);
  return true;
}

/**
 * Register a question type in the course config
 */
export function registerQuestionType(
  question: ProcessedQuestionData,
  courseConfig: CourseConfig
): boolean {
  if (isQuestionTypeRegistered(question, courseConfig)) {
    console.log(
      `   ℹ️  QuestionType '${question.name}' from '${question.course}' already registered`
    );
    return false;
  }

  const namespacedQuestionName = NameSpacer.getQuestionString({
    course: question.course,
    questionType: question.name,
  });

  // Build view list
  const viewList = question.views.map((view) => {
    if (view.name) {
      return view.name;
    } else {
      return 'unnamedComponent';
    }
  });

  // Build data shape list
  const dataShapeList = question.dataShapes.map((dataShape) =>
    NameSpacer.getDataShapeString({
      course: question.course,
      dataShape: dataShape.name,
    })
  );

  // Add question type to course config
  courseConfig.questionTypes.push({
    name: namespacedQuestionName,
    viewList: viewList,
    dataShapeList: dataShapeList,
  });

  // Cross-reference: Add this question type to its data shapes
  question.dataShapes.forEach((dataShape) => {
    const namespacedDataShapeName = NameSpacer.getDataShapeString({
      course: question.course,
      dataShape: dataShape.name,
    });

    for (const ds of courseConfig.dataShapes) {
      if (ds.name === namespacedDataShapeName) {
        ds.questionTypes.push(namespacedQuestionName);
      }
    }
  });

  console.log(`   ✅ Registered QuestionType: ${namespacedQuestionName}`);
  return true;
}

/**
 * Register seed data for a question type (similar to ComponentRegistration)
 */
export async function registerSeedData(
  question: ProcessedQuestionData,
  courseDB: CourseDBInterface
  // courseName: string
): Promise<void> {
  if (question.questionClass.seedData && Array.isArray(question.questionClass.seedData)) {
    console.log(`   📦 Registering seed data for question: ${question.name}`);

    try {
      const currentUser = await getCurrentUser();

      question.questionClass.seedData.forEach((seedDataItem: unknown) => {
        if (question.dataShapes.length > 0) {
          courseDB.addNote(
            question.course,
            question.dataShapes[0],
            seedDataItem,
            currentUser.getUsername(),
            []
          );
        }
      });

      console.log(`   ✅ Seed data registered for question: ${question.name}`);
    } catch (error) {
      console.warn(
        `   ⚠️  Failed to register seed data for question '${question.name}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Main function to register all custom question types and data shapes
 */
export async function registerCustomQuestionTypes(
  customQuestions: CustomQuestionsData,
  courseConfig: CourseConfig,
  courseDB: CourseDBInterface
  // courseName: string
): Promise<{ success: boolean; registeredCount: number; errorMessage?: string }> {
  try {
    console.log('🎨 Studio Mode: Beginning custom question registration');
    console.log(`   📊 Processing ${customQuestions.questionClasses.length} question classes`);

    const { dataShapes, questions } = processCustomQuestionsData(customQuestions);

    console.log(`   📊 Found ${dataShapes.length} data shapes and ${questions.length} questions`);

    let registeredCount = 0;

    // First, register all data shapes
    console.log('   📋 Registering data shapes...');
    for (const dataShape of dataShapes) {
      if (registerDataShape(dataShape, courseConfig)) {
        registeredCount++;
      }
    }

    // Then, register all question types
    console.log('   🔧 Registering question types...');
    for (const question of questions) {
      if (registerQuestionType(question, courseConfig)) {
        registeredCount++;
      }
    }

    // Update the course config in the database
    console.log('   💾 Updating course configuration...');
    const updateResult = await courseDB.updateCourseConfig(courseConfig);

    if (!updateResult.ok) {
      throw new Error(`Failed to update course config: ${JSON.stringify(updateResult)}`);
    }

    // Register seed data for questions that have it
    console.log('   🌱 Registering seed data...');
    for (const question of questions) {
      await registerSeedData(question, courseDB /*, courseName */);
    }

    console.log(`   ✅ Custom question registration complete: ${registeredCount} items registered`);

    return { success: true, registeredCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Custom question registration failed: ${errorMessage}`);
    return { success: false, registeredCount: 0, errorMessage };
  }
}
