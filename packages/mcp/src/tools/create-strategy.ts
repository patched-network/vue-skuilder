import type { CourseDBInterface, ContentNavigationStrategyData } from '@vue-skuilder/db';
import { NavigatorRoles, Navigators, DocType } from '@vue-skuilder/db';
import {
  CreateStrategyInputSchema,
  type CreateStrategyInput,
  type CreateStrategyOutput,
} from '../types/strategies.js';
import {
  handleToolError,
  logToolStart,
  logToolSuccess,
  logToolWarning,
} from '../utils/index.js';

const TOOL_NAME = 'create_strategy';

/**
 * Sanitize a string for use in a document ID.
 * Replaces spaces and special characters with hyphens.
 */
function sanitizeForId(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a strategy document ID.
 * Format: NAVIGATION_STRATEGY-{implementingClass}-{sanitizedName}
 */
function generateStrategyId(
  implementingClass: string,
  name: string,
  suffix?: string
): `NAVIGATION_STRATEGY-${string}` {
  const sanitizedName = sanitizeForId(name);
  const base = `NAVIGATION_STRATEGY-${implementingClass}-${sanitizedName}`;
  if (suffix) {
    return `${base}-${suffix}` as `NAVIGATION_STRATEGY-${string}`;
  }
  return base as `NAVIGATION_STRATEGY-${string}`;
}

/**
 * Check if a strategy ID already exists in the database.
 */
async function strategyExists(
  courseDB: CourseDBInterface,
  strategyId: string
): Promise<boolean> {
  try {
    await courseDB.getNavigationStrategy(strategyId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Handle the create_strategy tool.
 *
 * Creates a new navigation strategy with the specified configuration.
 * Validates that the implementing class is a valid NavigatorRoles key.
 * Auto-generates unique IDs with collision handling.
 */
export async function handleCreateStrategy(
  courseDB: CourseDBInterface,
  input: CreateStrategyInput
): Promise<CreateStrategyOutput> {
  try {
    // Validate input
    const validatedInput = CreateStrategyInputSchema.parse(input);
    logToolStart(TOOL_NAME, validatedInput);

    // Validate implementing class against NavigatorRoles
    const validImplementingClasses = Object.values(Navigators);
    if (!validImplementingClasses.includes(validatedInput.implementingClass as Navigators)) {
      const errorMsg = `Invalid implementingClass: "${validatedInput.implementingClass}". ` +
        `Valid options: ${validImplementingClasses.join(', ')}`;
      logToolWarning(TOOL_NAME, errorMsg);
      throw new Error(errorMsg);
    }

    // Validate serializedData is valid JSON if provided
    if (validatedInput.serializedData) {
      try {
        JSON.parse(validatedInput.serializedData);
      } catch {
        const errorMsg = 'serializedData must be valid JSON';
        logToolWarning(TOOL_NAME, errorMsg);
        throw new Error(errorMsg);
      }
    }

    // Generate strategy ID with collision handling
    let strategyId = generateStrategyId(
      validatedInput.implementingClass,
      validatedInput.name
    );

    // Check for collision and append timestamp suffix if needed
    if (await strategyExists(courseDB, strategyId)) {
      const suffix = Date.now().toString();
      strategyId = generateStrategyId(
        validatedInput.implementingClass,
        validatedInput.name,
        suffix
      );
      logToolWarning(
        TOOL_NAME,
        `ID collision detected, using suffix: ${strategyId}`
      );
    }

    // Construct the strategy document
    const courseId = courseDB.getCourseID();
    const strategyData: ContentNavigationStrategyData = {
      _id: strategyId,
      docType: DocType.NAVIGATION_STRATEGY,
      course: courseId,
      name: validatedInput.name,
      description: validatedInput.description,
      implementingClass: validatedInput.implementingClass,
      serializedData: validatedInput.serializedData || '',
    };

    // Add optional learnable weight
    if (validatedInput.learnable) {
      strategyData.learnable = {
        weight: validatedInput.learnable.weight,
        confidence: validatedInput.learnable.confidence,
        sampleSize: validatedInput.learnable.sampleSize,
      };
    }

    // Add optional static weight flag
    if (validatedInput.staticWeight !== undefined) {
      strategyData.staticWeight = validatedInput.staticWeight;
    }

    // Save the strategy to the database
    await courseDB.addNavigationStrategy(strategyData);

    // Determine role for success message
    const role = NavigatorRoles[validatedInput.implementingClass as Navigators];
    const roleLabel = role === 'generator' ? 'generator' : 'filter';

    const output: CreateStrategyOutput = {
      success: true,
      strategyId,
      message: `Created ${roleLabel} strategy: ${validatedInput.name}`,
    };

    logToolSuccess(TOOL_NAME, output);
    return output;
  } catch (error) {
    handleToolError(error, TOOL_NAME);
  }
}