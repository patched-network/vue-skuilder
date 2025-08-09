import type { CourseDBInterface } from '@vue-skuilder/db';
import { isSuccessRow } from '../utils/index.js';

export interface ShapeResource {
  name: string;
  description?: string;
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
    description?: string;
  }>;
  category?: string;
  examples?: any[];
}

export interface ShapesCollection {
  shapes: ShapeResource[];
  total: number;
  availableShapes: string[];
}

/**
 * Handle shapes://all resource - List all available DataShapes
 */
export async function handleShapesAllResource(
  courseDB: CourseDBInterface
): Promise<ShapesCollection> {
  try {
    // Get course config to access DataShapes
    const courseConfig = await courseDB.getCourseConfig();
    const dataShapes = courseConfig.dataShapes || [];

    // Transform DataShapes to ShapeResource format
    const shapes: ShapeResource[] = dataShapes.map((shape) => ({
      name: shape.name,
      description: `DataShape for ${shape.name} content type`,
      fields:
        (shape as any).fields?.map((field: any) => ({
          name: field.name,
          type: field.type || 'string',
          required: field.required || false,
          description: field.description || `Field for ${field.name}`,
        })) || [],
      category: 'course-content',
      examples: [], // Could be populated with example cards
    }));

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
 * Handle shapes://[shapeName] resource - Get specific DataShape definition
 */
export async function handleShapeSpecificResource(
  courseDB: CourseDBInterface,
  shapeName: string
): Promise<ShapeResource> {
  try {
    // Get course config to access DataShapes
    const courseConfig = await courseDB.getCourseConfig();
    const dataShapes = courseConfig.dataShapes || [];

    // Find the specific shape
    const targetShape = dataShapes.find((shape) => shape.name === shapeName);
    if (!targetShape) {
      const availableShapes = dataShapes.map((s) => s.name);
      throw new Error(
        `DataShape not found: ${shapeName}. Available shapes: ${availableShapes.join(', ')}`
      );
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
      fields:
        (targetShape as any).fields?.map((field: any) => ({
          name: field.name,
          type: field.type || 'string',
          required: field.required || false,
          description: field.description || `Field for ${field.name}`,
        })) || [],
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
