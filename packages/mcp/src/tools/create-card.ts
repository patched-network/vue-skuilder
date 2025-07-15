import { z } from 'zod';
import type { CourseDBInterface } from '@vue-skuilder/db';
import { CreateCardInputSchema, type CreateCardInput, type CreateCardOutput } from '../types/tools.js';
import { toCourseElo } from '@vue-skuilder/common';

export async function handleCreateCard(
  courseDB: CourseDBInterface,
  input: CreateCardInput
): Promise<CreateCardOutput> {
  try {
    // Validate input
    const validatedInput = CreateCardInputSchema.parse(input);
    
    // Get course config to validate datashape
    const courseConfig = await courseDB.getCourseConfig();
    const availableDataShapes = courseConfig.dataShapes.map(ds => ds.name);
    
    if (!availableDataShapes.includes(validatedInput.datashape)) {
      throw new Error(`Invalid datashape: ${validatedInput.datashape}. Available: ${availableDataShapes.join(', ')}`);
    }
    
    // Create the card via courseDB
    const result = await courseDB.addNote(
      courseConfig.courseID!, // Use the course ID from config
      { name: validatedInput.datashape as any, fields: [] }, // Basic DataShape structure
      validatedInput.data,
      'mcp-agent', // Author - could be configurable
      validatedInput.tags || [],
      undefined, // No uploads for now
      validatedInput.elo ? toCourseElo(validatedInput.elo) : undefined
    );
    
    if (result.status !== 'ok') {
      throw new Error(`Failed to create card: ${result.message || 'Unknown error'}`);
    }
    
    // Extract initial ELO from result or use default
    const initialElo = validatedInput.elo || 1500; // Default ELO
    
    return {
      cardId: result.id || 'unknown',
      initialElo,
      created: true
    };
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}