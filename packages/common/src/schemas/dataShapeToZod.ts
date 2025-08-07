import { z, ZodRawShape } from 'zod';
import { DataShape, FieldDefinition, FieldType, Status } from '../index.js';

/**
 * Converts a FieldType enum to appropriate Zod schema
 */
function fieldTypeToZodSchema(field: FieldDefinition): z.ZodTypeAny {
  let baseSchema: z.ZodTypeAny;

  switch (field.type) {
    case FieldType.STRING:
      baseSchema = z.string().min(1, `${field.name} cannot be empty`);
      break;

    case FieldType.MARKDOWN:
      baseSchema = z.string().min(1, `${field.name} cannot be empty`);

      // Special handling for known patterns like Blanks
      if (field.name === 'Input') {
        baseSchema = baseSchema
          .refine(
            (value): value is string => typeof value === 'string' && value.includes('{{') && value.includes('}}'),
            'Must contain at least one blank in format {{answer}} or {{answer1|answer2||distractor}}'
          )
          .describe(
            "Markdown text with blanks. Format: {{answer}} for fill-in or {{answer1|answer2||distractor1|distractor2}} for multiple choice. Use the 'fill-in-card-authoring' MCP prompt for detailed syntax guidance."
          );
      } else {
        baseSchema = baseSchema.describe('Markdown content');
      }
      break;

    case FieldType.NUMBER:
      baseSchema = z.number().describe(`Numeric value for ${field.name}`);
      break;

    case FieldType.INT:
      baseSchema = z.number().int().describe(`Integer value for ${field.name}`);
      break;

    case FieldType.IMAGE:
      baseSchema = z.any().optional().describe('Image file');
      break;

    case FieldType.AUDIO:
      baseSchema = z.any().optional().describe('Audio file');
      break;

    case FieldType.MIDI:
      baseSchema = z.any().optional().describe('MIDI file');
      break;

    case FieldType.MEDIA_UPLOADS:
      baseSchema = z
        .array(z.any())
        .optional()
        .describe('Optional media files (images, audio, etc.)');
      break;

    case FieldType.CHESS_PUZZLE:
      baseSchema = z
        .string()
        .min(1, 'Chess puzzle cannot be empty')
        .describe('Chess puzzle in FEN or PGN format');
      break;

    default:
      baseSchema = z.any().describe(`Field of type ${field.type}`);
  }

  // Add custom validation if present
  if (field.validator) {
    const originalValidator = field.validator;
    baseSchema = baseSchema.refine(
      (value) => {
        try {
          const result = originalValidator.test(String(value));
          return result.status === Status.ok;
        } catch {
          return false;
        }
      },
      {
        message: originalValidator.instructions || `Validation failed for ${field.name}`,
      }
    );

    // Add validator instructions as description if available
    if (originalValidator.instructions) {
      baseSchema = baseSchema.describe(
        `${baseSchema.description || ''}\nInstructions: ${originalValidator.instructions}`.trim()
      );
    }
  }

  return baseSchema;
}

/**
 * Converts a DataShape to a Zod schema
 */
export function toZod(dataShape: DataShape): z.ZodObject<ZodRawShape> {
  const schemaFields: Record<string, z.ZodTypeAny> = {};

  dataShape.fields.forEach((field) => {
    schemaFields[field.name] = fieldTypeToZodSchema(field);
  });

  return z.object(schemaFields).describe(`DataShape: ${dataShape.name} - Schema for card creation`);
}

/**
 * Converts a DataShape to JSON Schema string using Zod v4 native conversion
 */
export function toZodJSON(dataShape: DataShape): string {
  const zodSchema = toZod(dataShape);
  const jsonSchema = z.toJSONSchema(zodSchema);
  return JSON.stringify(jsonSchema, null, 2);
}
