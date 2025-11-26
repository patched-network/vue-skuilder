import type { CourseDBInterface } from '@vue-skuilder/db';
import { isSuccessRow } from '../utils/index.js';

export interface ShapeResource {
  name: string;
  description?: string;
  schema: any; // The serialized Zod schema as JSON - this is what create_card validates against
  category?: string;
  examples?: any[];
}

export interface ShapesCollection {
  shapes: ShapeResource[];
  total: number;
  availableShapes: string[];
}

/**
 * Handle shapes://all resource - List all available DataShapes for this course
 */
export async function handleShapesAllResource(
  courseDB: CourseDBInterface
): Promise<ShapesCollection> {
  try {
    // Get course-specific DataShapes from the course configuration
    const config = await courseDB.getCourseConfig();
    const dataShapes = config.dataShapes || [];

    // Transform DataShapes to ShapeResource format
    const shapes: ShapeResource[] = dataShapes.map((shape) => {
      // Parse the serialized Zod schema if available
      let schema: any = null;
      if (shape.serializedZodSchema) {
        try {
          schema = JSON.parse(shape.serializedZodSchema);
        } catch (error) {
          console.warn(`Failed to parse schema for ${shape.name}:`, error);
          schema = { error: 'Failed to parse schema' };
        }
      }

      return {
        name: shape.name,
        description: `DataShape for ${shape.name} content type`,
        schema, // Return the actual JSON schema that create_card validates against
        category: 'course-content',
        examples: [], // Could be populated with example cards
      };
    });

    const availableShapes = dataShapes.map((shape) => shape.name);

    return {
      shapes,
      total: shapes.length,
      availableShapes,
    };
  } catch (error) {
    console.error('Error fetching all shapes:', error);
    throw new Error(
      `Failed to fetch shapes: ${error instanceof Error ? error.message : `Unknown error: ${JSON.stringify(error)}`}`
    );
  }
}

/**
 * Handle shapes://[shapeName] resource - Get specific DataShape definition for this course
 */
export async function handleShapeSpecificResource(
  courseDB: CourseDBInterface,
  shapeName: string
): Promise<ShapeResource> {
  try {
    // Get course-specific DataShapes from the course configuration
    const config = await courseDB.getCourseConfig();
    const dataShapes = config.dataShapes || [];

    // Find the specific shape
    const targetShape = dataShapes.find((shape) => shape.name === shapeName);
    if (!targetShape) {
      const availableShapes = dataShapes.map((s) => s.name);
      throw new Error(
        `DataShape not found: ${shapeName}. Available shapes: ${availableShapes.join(', ')}`
      );
    }

    // Parse the serialized Zod schema
    let schema: any = null;
    if (targetShape.serializedZodSchema) {
      try {
        schema = JSON.parse(targetShape.serializedZodSchema);
      } catch (error) {
        console.warn(`Failed to parse schema for ${shapeName}:`, error);
        schema = { error: 'Failed to parse schema' };
      }
    }

    // Get examples by finding cards that use this shape
    let examples: any[] = [];
    try {
      // Get a few cards that use this shape to provide examples
      const cards = await courseDB.getCardsByELO(1500, 10); // Get some sample cards
      if (cards.length > 0) {
        const cardDocs = await courseDB.getCourseDocs(cards.map(c=>c.cardID).slice(0, 5)); // Limit to 5 examples
        examples = [];
        for (const row of cardDocs.rows) {
          if (isSuccessRow(row) && (row.doc as any).shape?.name === shapeName) {
            const data = (row.doc as any)?.data;
            if (data) {
              examples.push(data);
              if (examples.length >= 3) break; // Max 3 examples
            }
          }
        }
      }
    } catch (error) {
      console.warn('Could not fetch examples for shape:', error);
      // Continue without examples
    }

    return {
      name: targetShape.name,
      description: `DataShape definition for ${targetShape.name} content type`,
      schema, // Return the actual JSON schema that create_card validates against
      category: 'course-content',
      examples,
    };
  } catch (error) {
    console.error(`Error fetching shape ${shapeName}:`, error);
    throw new Error(
      `Failed to fetch shape ${shapeName}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
