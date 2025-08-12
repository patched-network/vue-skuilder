import { CourseDBInterface } from '@vue-skuilder/db';

/**
 * Schema resource response structure
 */
export interface SchemaResource {
  dataShapeName: string;
  jsonSchema: object;
  schemaString: string;
  available: boolean;
  lastUpdated?: string;
}

/**
 * Handle schema resource request for a specific DataShape
 * Returns the JSON Schema for the DataShape if available
 */
export async function handleSchemaResource(
  _courseDB: CourseDBInterface,
  dataShapeName: string
): Promise<SchemaResource> {
  // Import DataShapes from courseware backend (avoids Vue dependencies)
  const { getAllDataShapesRaw } = await import('@vue-skuilder/courseware/backend');
  const dataShapes = getAllDataShapesRaw();
  
  // Find the DataShape
  const dataShape = dataShapes.find(ds => ds.name === dataShapeName);
  
  if (!dataShape) {
    return {
      dataShapeName,
      jsonSchema: {},
      schemaString: '',
      available: false,
    };
  }

  // Generate JSON Schema from DataShape fields
  const jsonSchema = {
    type: 'object',
    properties: {} as any,
    required: [] as string[],
    title: dataShape.name,
  };

  if (dataShape.fields) {
    for (const field of dataShape.fields) {
      // Map Vue-Skuilder field types to JSON Schema types
      const jsonType = field.type === 'int' ? 'integer' : 'string';
      
      jsonSchema.properties[field.name] = {
        type: jsonType,
        description: field.description || `Field ${field.name} (${field.type})`,
      };
      if (field.required) {
        jsonSchema.required.push(field.name);
      }
    }
  }

  return {
    dataShapeName,
    jsonSchema,
    schemaString: JSON.stringify(jsonSchema, null, 2),
    available: true,
  };
}