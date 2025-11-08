import type { CourseDBInterface } from '@vue-skuilder/db';
import {
  CreateCardInputSchema,
  type CreateCardInput,
  type CreateCardOutput,
} from '../types/tools.js';
import { toCourseElo, NameSpacer } from '@vue-skuilder/common';
import { getAllDataShapesRaw } from '@vue-skuilder/courseware/backend';
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

    // Fix: Claude Code's MCP client sends data as a JSON string instead of an object
    // Parse it if it's a string
    if (typeof validatedInput.data === 'string') {
      try {
        validatedInput.data = JSON.parse(validatedInput.data);
      } catch (e) {
        throw new Error(`Invalid JSON in data parameter: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

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

    // Get the complete DataShape definition from course config
    const matchingDataShape = courseConfig.dataShapes.find(
      (ds) => ds.name === validatedInput.datashape
    );
    if (!matchingDataShape) {
      const errorMsg = `DataShape not found in course configuration: ${validatedInput.datashape}`;
      logToolWarning(TOOL_NAME, errorMsg);
      throw new Error(errorMsg);
    }

    // Get runtime DataShape definition from courseware
    const runtimeDataShape = getAllDataShapesRaw()
      .find((ds) => ds.name === shapeDescriptor.dataShape);

    if (!runtimeDataShape) {
      const errorMsg = `Runtime DataShape not found in courseware: ${shapeDescriptor.dataShape}`;
      logToolWarning(TOOL_NAME, errorMsg);
      throw new Error(errorMsg);
    }

    logToolStart(
      TOOL_NAME,
      `Using runtime DataShape with ${runtimeDataShape.fields.length} fields`
    );

    // Use complete DataShape with field definitions from courseware
    const dataShape = runtimeDataShape;

    // Create the card via courseDB
    const result = await courseDB.addNote(
      shapeDescriptor.course, // Use courseware name, not courseID
      dataShape,
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
