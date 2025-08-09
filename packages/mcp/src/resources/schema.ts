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
  courseDB: CourseDBInterface,
  dataShapeName: string
): Promise<SchemaResource> {
  const courseConfig = await courseDB.getCourseConfig();
  
  // Find the DataShape in course config
  const dataShape = courseConfig.dataShapes.find(ds => ds.name === dataShapeName);
  
  if (!dataShape) {
    return {
      dataShapeName,
      jsonSchema: {},
      schemaString: '',
      available: false,
    };
  }

  if (!dataShape.serializedZodSchema) {
    return {
      dataShapeName,
      jsonSchema: {},
      schemaString: '',
      available: false,
    };
  }

  let jsonSchema: object;
  try {
    jsonSchema = JSON.parse(dataShape.serializedZodSchema);
  } catch (error) {
    console.warn(`Failed to parse schema for ${dataShapeName}:`, error);
    return {
      dataShapeName,
      jsonSchema: {},
      schemaString: '',
      available: false,
    };
  }

  return {
    dataShapeName,
    jsonSchema,
    schemaString: dataShape.serializedZodSchema,
    available: true,
  };
}