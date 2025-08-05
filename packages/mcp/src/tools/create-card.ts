import type { CourseDBInterface } from '@vue-skuilder/db';
import {
  CreateCardInputSchema,
  type CreateCardInput,
  type CreateCardOutput,
} from '../types/tools.js';
import { toCourseElo, NameSpacer } from '@vue-skuilder/common';
import {
  MCP_AGENT_AUTHOR,
  handleToolError,
  logToolStart,
  logToolSuccess,
  logToolWarning,
} from '../utils/index.js';

export async function handleCreateCard(
  courseDB: CourseDBInterface,
  input: CreateCardInput
): Promise<CreateCardOutput> {
  const TOOL_NAME = 'create_card';

  try {
    // Validate input and log start
    const validatedInput = CreateCardInputSchema.parse(input);
    logToolStart(TOOL_NAME, validatedInput);

    // Get course config to validate datashape
    const courseConfig = await courseDB.getCourseConfig();
    const availableDataShapes = courseConfig.dataShapes.map((ds) => ds.name);

    if (!availableDataShapes.includes(validatedInput.datashape)) {
      const errorMsg = `Invalid datashape: ${validatedInput.datashape}. Available: ${availableDataShapes.join(', ')}`;
      logToolWarning(TOOL_NAME, errorMsg);
      throw new Error(errorMsg);
    }

    // Extract courseware name and local datashape name from fully-qualified name
    let shapeDescriptor: any;
    try {
      shapeDescriptor = NameSpacer.getDataShapeDescriptor(validatedInput.datashape);
    } catch (error) {
      const errorMsg = `Malformed datashape name: ${validatedInput.datashape}. Expected format: course.datashape.name`;
      logToolWarning(TOOL_NAME, errorMsg);
      throw new Error(errorMsg);
    }

    // Create the card via courseDB
    const result = await courseDB.addNote(
      shapeDescriptor.course, // Use courseware name, not courseID
      { name: shapeDescriptor.dataShape as any, fields: [] },
      validatedInput.data,
      MCP_AGENT_AUTHOR,
      validatedInput.tags || [],
      undefined, // No uploads for now
      validatedInput.elo ? toCourseElo(validatedInput.elo) : undefined
    );

    if (result.status !== 'ok') {
      const errorMsg = `Failed to create card: ${result.message || 'Unknown error'}`;
      throw new Error(errorMsg);
    }

    // Extract initial ELO from result or use default
    const initialElo = validatedInput.elo || 1500;

    const output = {
      cardId: result.id || 'unknown',
      initialElo,
      created: true,
    };

    logToolSuccess(TOOL_NAME, output);
    return output;
  } catch (error) {
    handleToolError(error, TOOL_NAME);
  }
}
