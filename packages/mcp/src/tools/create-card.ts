import type { CourseDBInterface } from '@vue-skuilder/db';
import {
  CreateCardInputSchema,
  type CreateCardInput,
  type CreateCardOutput,
} from '../types/tools.js';
import { toCourseElo, NameSpacer, FieldType, type DataShape, type FieldDefinition } from '@vue-skuilder/common';
import {
  MCP_AGENT_AUTHOR,
  handleToolError,
  logToolStart,
  logToolSuccess,
  logToolWarning,
} from '../utils/index.js';

/**
 * Reconstructs a minimal DataShape from course config's serialized JSON Schema
 * Only extracts field names and types - no validators or custom logic
 */
function reconstructDataShapeFromConfig(
  dataShapeName: string,
  serializedSchema: string
): DataShape {
  const jsonSchema = JSON.parse(serializedSchema);
  const fields: FieldDefinition[] = [];

  if (jsonSchema.properties) {
    for (const [fieldName, fieldSchema] of Object.entries(jsonSchema.properties)) {
      const schema = fieldSchema as any;

      // Map JSON Schema types to FieldType enum
      let fieldType: FieldType = FieldType.STRING; // default

      if (schema.type === 'string') {
        if (schema.contentEncoding === 'base64' || fieldName.toLowerCase().includes('image')) {
          fieldType = FieldType.IMAGE;
        } else if (fieldName.toLowerCase().includes('audio')) {
          fieldType = FieldType.AUDIO;
        } else if (schema.description?.includes('Markdown') || schema.description?.includes('markdown')) {
          fieldType = FieldType.MARKDOWN;
        } else {
          fieldType = FieldType.STRING;
        }
      } else if (schema.type === 'number') {
        fieldType = FieldType.NUMBER;
      } else if (schema.type === 'integer') {
        fieldType = FieldType.INT;
      } else if (schema.type === 'array') {
        // Check if it's uploads/media
        if (fieldName === 'Uploads' || fieldName.toLowerCase().includes('upload')) {
          fieldType = FieldType.MEDIA_UPLOADS;
        }
      }

      fields.push({
        name: fieldName,
        type: fieldType,
      });
    }
  }

  return {
    name: dataShapeName as any, // Cast to DataShapeName - it's just a string at runtime
    fields,
  };
}

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

    // Get the DataShape definition from course config
    const matchingDataShape = courseConfig.dataShapes.find(
      (ds) => ds.name === validatedInput.datashape
    );
    if (!matchingDataShape) {
      const errorMsg = `DataShape not found in course configuration: ${validatedInput.datashape}`;
      logToolWarning(TOOL_NAME, errorMsg);
      throw new Error(errorMsg);
    }

    // Reconstruct DataShape from course config's serialized schema
    // This bypasses the need for runtime courseware loading - we only need
    // field names and types, which we can derive from the JSON Schema
    const dataShape = reconstructDataShapeFromConfig(
      shapeDescriptor.dataShape,
      matchingDataShape.serializedZodSchema!
    );

    logToolStart(
      TOOL_NAME,
      `Using DataShape with ${dataShape.fields.length} fields (reconstructed from course config)`
    );

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
