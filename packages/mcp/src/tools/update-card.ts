import type { CourseDBInterface } from '@vue-skuilder/db';
import { UpdateCardInputSchema, type UpdateCardInput, type UpdateCardOutput } from '../types/tools.js';
import { toCourseElo } from '@vue-skuilder/common';
import { MCP_AGENT_AUTHOR, handleToolError, logToolStart, logToolSuccess, logToolWarning } from '../utils/index.js';

export async function handleUpdateCard(
  courseDB: CourseDBInterface,
  input: UpdateCardInput
): Promise<UpdateCardOutput> {
  const TOOL_NAME = 'update_card';
  
  try {
    // Validate input and log start
    const validatedInput = UpdateCardInputSchema.parse(input);
    logToolStart(TOOL_NAME, validatedInput);
    
    // Track what changes were made
    const changes = {
      data: false,
      tags: false,
      elo: false,
      sourceRef: false
    };

    // Verify the card exists
    try {
      await courseDB.getCourseDoc(validatedInput.cardId);
    } catch (error) {
      throw new Error(`Card not found: ${validatedInput.cardId}`);
    }

    // Update ELO if provided
    if (validatedInput.elo !== undefined) {
      try {
        const courseElo = toCourseElo(validatedInput.elo);
        await courseDB.updateCardElo(validatedInput.cardId, courseElo);
        changes.elo = true;
      } catch (error) {
        logToolWarning(TOOL_NAME, `Failed to update ELO for card ${validatedInput.cardId}`, error);
        throw new Error(`Failed to update ELO: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update tags if provided
    if (validatedInput.tags !== undefined) {
      try {
        // Get current tags to determine what needs to be added/removed
        const currentTagsResponse = await courseDB.getAppliedTags(validatedInput.cardId);
        const currentTagNames = currentTagsResponse.rows.map(row => row.doc?.name).filter(Boolean) as string[];
        
        const newTags = validatedInput.tags;
        const tagsToAdd = newTags.filter(tag => !currentTagNames.includes(tag));
        const tagsToRemove = currentTagNames.filter(tag => !newTags.includes(tag));

        // Add new tags
        for (const tagName of tagsToAdd) {
          try {
            // Check if tag exists, if not create it
            try {
              await courseDB.getTag(tagName);
            } catch {
              // Tag doesn't exist, create it
              await courseDB.createTag(tagName, MCP_AGENT_AUTHOR);
            }
            
            await courseDB.addTagToCard(validatedInput.cardId, tagName);
          } catch (error) {
            logToolWarning(TOOL_NAME, `Failed to add tag ${tagName} to card`, error);
            // Continue with other tags
          }
        }

        // Remove old tags
        for (const tagName of tagsToRemove) {
          try {
            await courseDB.removeTagFromCard(validatedInput.cardId, tagName);
          } catch (error) {
            logToolWarning(TOOL_NAME, `Failed to remove tag ${tagName} from card`, error);
            // Continue with other tags
          }
        }

        if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
          changes.tags = true;
        }
      } catch (error) {
        logToolWarning(TOOL_NAME, `Failed to update tags for card ${validatedInput.cardId}`, error);
        throw new Error(`Failed to update tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update data and sourceRef if provided
    // Note: CourseDBInterface doesn't have direct methods for updating card data
    // This would require more complex PouchDB operations
    if (validatedInput.data !== undefined || validatedInput.sourceRef !== undefined) {
      logToolWarning(TOOL_NAME, 'Data and sourceRef updates are not yet implemented - require direct PouchDB operations');
      // TODO: Implement direct document updates for data and sourceRef
      // For now, we'll skip these updates but note them in the response
    }

    const updated = changes.elo || changes.tags || changes.data || changes.sourceRef;

    const output = {
      cardId: validatedInput.cardId,
      updated,
      changes
    };
    
    logToolSuccess(TOOL_NAME, output);
    return output;

  } catch (error) {
    handleToolError(error, TOOL_NAME);
  }
}