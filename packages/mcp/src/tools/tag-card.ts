import type { CourseDBInterface } from '@vue-skuilder/db';
import { TagCardInputSchema, type TagCardInput, type TagCardOutput } from '../types/tools.js';
import { MCP_AGENT_AUTHOR, handleToolError, logToolStart, logToolSuccess, logToolWarning } from '../utils/index.js';

export async function handleTagCard(
  courseDB: CourseDBInterface,
  input: TagCardInput
): Promise<TagCardOutput> {
  const TOOL_NAME = 'tag_card';
  
  try {
    // Validate input and log start
    const validatedInput = TagCardInputSchema.parse(input);
    logToolStart(TOOL_NAME, validatedInput);
    
    // Verify the card exists
    try {
      await courseDB.getCourseDoc(validatedInput.cardId);
    } catch (error) {
      throw new Error(`Card not found: ${validatedInput.cardId}`);
    }

    const tagsProcessed: string[] = [];
    let success = true;
    
    // Process each tag
    for (const tagName of validatedInput.tags) {
      try {
        if (validatedInput.action === 'add') {
          // Check if tag exists, if not create it
          try {
            await courseDB.getTag(tagName);
          } catch {
            // Tag doesn't exist, create it
            await courseDB.createTag(tagName, MCP_AGENT_AUTHOR);
          }
          
          // Add tag to card
          await courseDB.addTagToCard(
            validatedInput.cardId, 
            tagName, 
            validatedInput.updateELO
          );
          tagsProcessed.push(tagName);
          
        } else if (validatedInput.action === 'remove') {
          // Remove tag from card
          await courseDB.removeTagFromCard(validatedInput.cardId, tagName);
          tagsProcessed.push(tagName);
        }
      } catch (error) {
        logToolWarning(TOOL_NAME, `Failed to ${validatedInput.action} tag ${tagName}`, error);
        success = false;
        // Continue with other tags
      }
    }

    // Get current tags to return in response
    let currentTags: string[] = [];
    try {
      const currentTagsResponse = await courseDB.getAppliedTags(validatedInput.cardId);
      currentTags = currentTagsResponse.rows
        .map(row => row.doc?.name)
        .filter(Boolean) as string[];
    } catch (error) {
      logToolWarning(TOOL_NAME, 'Failed to fetch current tags', error);
    }

    const output = {
      cardId: validatedInput.cardId,
      action: validatedInput.action,
      tagsProcessed,
      success: success && tagsProcessed.length === validatedInput.tags.length,
      currentTags
    };
    
    logToolSuccess(TOOL_NAME, output);
    return output;

  } catch (error) {
    handleToolError(error, TOOL_NAME);
  }
}