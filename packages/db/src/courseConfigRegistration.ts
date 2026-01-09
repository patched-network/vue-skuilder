import { CourseConfig, DataShape, NameSpacer, toZodJSON } from '@vue-skuilder/common';
import { CourseDBInterface } from './core/interfaces/courseDB.js';
import { logger } from './util/logger.js';

/**
 * Interface for custom questions data structure returned by allCustomQuestions()
 */
export interface CustomQuestionsData {
  courses: { name: string }[]; // Course instances with question instances
  questionClasses: {
    name: string;
    dataShapes?: DataShape[];
    views?: { name?: string }[];
    seedData?: unknown[];
  }[]; // Question class constructors
  dataShapes: DataShape[]; // DataShape definitions for studio-ui
  views: { name?: string }[]; // Vue components for rendering
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
  questionClass: {
    name: string;
    dataShapes?: DataShape[];
    views?: { name?: string }[];
    seedData?: unknown[];
  };
  dataShapes: DataShape[];
  views: { name?: string }[];
}

/**
 * Interface for processed data shape for registration
 */
export interface ProcessedDataShape {
  name: string;
  course: string;
  dataShape: DataShape;
}

/**
 * Check if a data shape is already registered in the course config with valid schema
 */
export function isDataShapeRegistered(
  dataShape: ProcessedDataShape,
  courseConfig: CourseConfig
): boolean {
  const namespacedName = NameSpacer.getDataShapeString({
    dataShape: dataShape.name,
    course: dataShape.course,
  });

  const existingDataShape = courseConfig.dataShapes.find((ds) => ds.name === namespacedName);

  // existence sufficient to be considered "registered"
  return existingDataShape !== undefined;
}

export function isDataShapeSchemaAvailable(
  dataShape: ProcessedDataShape,
  courseConfig: CourseConfig
): boolean {
  const namespacedName = NameSpacer.getDataShapeString({
    dataShape: dataShape.name,
    course: dataShape.course,
  });

  const existingDataShape = courseConfig.dataShapes.find((ds) => ds.name === namespacedName);

  return existingDataShape !== undefined && existingDataShape.serializedZodSchema !== undefined;
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

    // Process data shapes from this question class (static property)
    if (questionClass.dataShapes && Array.isArray(questionClass.dataShapes)) {
      questionClass.dataShapes.forEach((dataShape) => {
        processedDataShapes.push({
          name: dataShape.name,
          course: courseName,
          dataShape: dataShape,
        });
      });
    }

    // Process the question itself
    processedQuestions.push({
      name: questionClass.name,
      course: courseName,
      questionClass: questionClass,
      dataShapes: questionClass.dataShapes || [],
      views: questionClass.views || [],
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
  const namespacedName = NameSpacer.getDataShapeString({
    dataShape: dataShape.name,
    course: dataShape.course,
  });

  // Generate JSON Schema for the DataShape
  let serializedZodSchema: string | undefined;
  try {
    serializedZodSchema = toZodJSON(dataShape.dataShape);
  } catch (error) {
    logger.warn(`Failed to generate schema for ${namespacedName}:`, error);
    serializedZodSchema = undefined;
  }

  // Check if DataShape already exists
  const existingIndex = courseConfig.dataShapes.findIndex((ds) => ds.name === namespacedName);

  if (existingIndex !== -1) {
    const existingDataShape = courseConfig.dataShapes[existingIndex];

    // If existing schema matches new schema, no update needed
    if (existingDataShape.serializedZodSchema === serializedZodSchema) {
      logger.info(
        `DataShape '${dataShape.name}' from '${dataShape.course}' already registered with identical schema`
      );
      return false;
    }

    // Schema has changed or was missing - update it
    if (existingDataShape.serializedZodSchema) {
      logger.info(
        `DataShape '${dataShape.name}' from '${dataShape.course}' schema has changed, updating...`
      );
    } else {
      logger.info(
        `DataShape '${dataShape.name}' from '${dataShape.course}' already registered, but with no schema. Adding schema to existing entry`
      );
    }

    // Update the existing entry
    courseConfig.dataShapes[existingIndex] = {
      name: namespacedName,
      questionTypes: existingDataShape.questionTypes, // Preserve existing question type associations
      serializedZodSchema,
    };

    logger.info(`Updated DataShape: ${namespacedName}`);
    return true;
  }

  courseConfig.dataShapes.push({
    name: namespacedName,
    questionTypes: [],
    serializedZodSchema,
  });

  logger.info(`Registered DataShape: ${namespacedName}`);
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
    logger.info(`QuestionType '${question.name}' from '${question.course}' already registered`);
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

  logger.info(`Registered QuestionType: ${namespacedQuestionName}`);
  return true;
}

/**
 * Remove a data shape from the course config
 * @returns true if the data shape was removed, false if it wasn't found
 */
export function removeDataShape(
  dataShapeName: string,
  courseConfig: CourseConfig
): boolean {
  const index = courseConfig.dataShapes.findIndex((ds) => ds.name === dataShapeName);

  if (index === -1) {
    logger.info(`DataShape '${dataShapeName}' not found in course config`);
    return false;
  }

  // Remove the data shape
  courseConfig.dataShapes.splice(index, 1);

  // Also remove references from any question types
  courseConfig.questionTypes.forEach((qt) => {
    const dsIndex = qt.dataShapeList.indexOf(dataShapeName);
    if (dsIndex !== -1) {
      qt.dataShapeList.splice(dsIndex, 1);
    }
  });

  logger.info(`Removed DataShape: ${dataShapeName}`);
  return true;
}

/**
 * Remove a question type from the course config
 * @returns true if the question type was removed, false if it wasn't found
 */
export function removeQuestionType(
  questionTypeName: string,
  courseConfig: CourseConfig
): boolean {
  const index = courseConfig.questionTypes.findIndex((qt) => qt.name === questionTypeName);

  if (index === -1) {
    logger.info(`QuestionType '${questionTypeName}' not found in course config`);
    return false;
  }

  // Remove the question type
  courseConfig.questionTypes.splice(index, 1);

  // Also remove references from data shapes
  courseConfig.dataShapes.forEach((ds) => {
    const qtIndex = ds.questionTypes.indexOf(questionTypeName);
    if (qtIndex !== -1) {
      ds.questionTypes.splice(qtIndex, 1);
    }
  });

  logger.info(`Removed QuestionType: ${questionTypeName}`);
  return true;
}

/**
 * Remove data shapes and question types from course config and persist to database
 */
export async function removeCustomQuestionTypes(
  dataShapeNames: string[],
  questionTypeNames: string[],
  courseConfig: CourseConfig,
  courseDB: CourseDBInterface
): Promise<{ success: boolean; removedCount: number; errorMessage?: string }> {
  try {
    logger.info('Beginning custom question removal');
    logger.info(`Removing ${dataShapeNames.length} data shapes and ${questionTypeNames.length} question types`);

    let removedCount = 0;

    // Remove question types first (they reference data shapes)
    for (const qtName of questionTypeNames) {
      if (removeQuestionType(qtName, courseConfig)) {
        removedCount++;
      }
    }

    // Then remove data shapes
    for (const dsName of dataShapeNames) {
      if (removeDataShape(dsName, courseConfig)) {
        removedCount++;
      }
    }

    // Update the course config in the database
    logger.info('Updating course configuration...');
    const updateResult = await courseDB.updateCourseConfig(courseConfig);

    if (!updateResult.ok) {
      throw new Error(`Failed to update course config: ${JSON.stringify(updateResult)}`);
    }

    logger.info(`Custom question removal complete: ${removedCount} items removed`);

    return { success: true, removedCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Custom question removal failed: ${errorMessage}`);
    return { success: false, removedCount: 0, errorMessage };
  }
}

/**
 * Register seed data for a question type
 *
 * @param question - The processed question data
 * @param courseDB - The course database interface
 * @param username - The username to attribute seed data to
 */
export async function registerSeedData(
  question: ProcessedQuestionData,
  courseDB: CourseDBInterface,
  username: string
): Promise<void> {
  if (question.questionClass.seedData && Array.isArray(question.questionClass.seedData)) {
    logger.info(`Registering seed data for question: ${question.name}`);

    try {
      const seedDataPromises = question.questionClass.seedData
        .filter(() => question.dataShapes.length > 0)
        .map((seedDataItem: unknown) =>
          courseDB.addNote(
            question.course,
            question.dataShapes[0],
            seedDataItem,
            username,
            []
          )
        );

      await Promise.all(seedDataPromises);
      logger.info(`Seed data registered for question: ${question.name}`);
    } catch (error) {
      logger.warn(
        `Failed to register seed data for question '${question.name}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Register BlanksCard (markdown fillIn) question type specifically
 */
export async function registerBlanksCard(
  BlanksCard: { name: string; views?: { name?: string }[] },
  BlanksCardDataShapes: DataShape[],
  courseConfig: CourseConfig,
  courseDB: CourseDBInterface,
  username?: string
): Promise<{ success: boolean; errorMessage?: string }> {
  try {
    logger.info('Registering BlanksCard data shapes and question type...');

    let registeredCount = 0;
    const courseName = 'default'; // BlanksCard comes from the default course

    // Register BlanksCard data shapes
    for (const dataShapeClass of BlanksCardDataShapes) {
      const processedDataShape: ProcessedDataShape = {
        name: dataShapeClass.name,
        course: courseName,
        dataShape: dataShapeClass,
      };

      if (registerDataShape(processedDataShape, courseConfig)) {
        registeredCount++;
      }
    }

    // Register BlanksCard question type
    const processedQuestion: ProcessedQuestionData = {
      name: BlanksCard.name,
      course: courseName,
      questionClass: {
        name: BlanksCard.name,
        dataShapes: BlanksCardDataShapes,
        views: BlanksCard.views || [],
      },
      dataShapes: BlanksCardDataShapes,
      views: BlanksCard.views || [],
    };

    if (registerQuestionType(processedQuestion, courseConfig)) {
      registeredCount++;
    }

    // Update the course config in the database
    logger.info('Updating course configuration with BlanksCard...');
    const updateResult = await courseDB.updateCourseConfig(courseConfig);

    if (!updateResult.ok) {
      throw new Error(`Failed to update course config: ${JSON.stringify(updateResult)}`);
    }

    // Register seed data if BlanksCard has any and username provided
    if (username) {
      await registerSeedData(processedQuestion, courseDB, username);
    }

    logger.info(`BlanksCard registration complete: ${registeredCount} items registered`);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`BlanksCard registration failed: ${errorMessage}`);
    return { success: false, errorMessage };
  }
}

/**
 * Main function to register all custom question types and data shapes
 *
 * @param customQuestions - The custom questions data from allCustomQuestions()
 * @param courseConfig - The course configuration object
 * @param courseDB - The course database interface
 * @param username - The username to attribute seed data to
 */
export async function registerCustomQuestionTypes(
  customQuestions: CustomQuestionsData,
  courseConfig: CourseConfig,
  courseDB: CourseDBInterface,
  username?: string
): Promise<{ success: boolean; registeredCount: number; errorMessage?: string }> {
  try {
    logger.info('Beginning custom question registration');
    logger.info(`Processing ${customQuestions.questionClasses.length} question classes`);

    const { dataShapes, questions } = processCustomQuestionsData(customQuestions);

    logger.info(`Found ${dataShapes.length} data shapes and ${questions.length} questions`);

    let registeredCount = 0;

    // First, register all data shapes
    logger.info('Registering data shapes...');
    for (const dataShape of dataShapes) {
      if (registerDataShape(dataShape, courseConfig)) {
        registeredCount++;
      }
    }

    // Then, register all question types
    logger.info('Registering question types...');
    for (const question of questions) {
      if (registerQuestionType(question, courseConfig)) {
        registeredCount++;
      }
    }

    // Update the course config in the database
    logger.info('Updating course configuration...');
    const updateResult = await courseDB.updateCourseConfig(courseConfig);

    if (!updateResult.ok) {
      throw new Error(`Failed to update course config: ${JSON.stringify(updateResult)}`);
    }

    // Register seed data for questions that have it (if username provided)
    if (username) {
      logger.info('Registering seed data...');
      for (const question of questions) {
        await registerSeedData(question, courseDB, username);
      }
    }

    logger.info(`Custom question registration complete: ${registeredCount} items registered`);

    return { success: true, registeredCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Custom question registration failed: ${errorMessage}`);
    return { success: false, registeredCount: 0, errorMessage };
  }
}
