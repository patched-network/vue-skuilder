import type { CourseDBInterface } from '@vue-skuilder/db';
import { DeleteCardInputSchema, type DeleteCardInput, type DeleteCardOutput } from '../types/tools.js';
import { handleToolError, logToolStart, logToolSuccess, logToolWarning, logToolError } from '../utils/index.js';

export async function handleDeleteCard(
  courseDB: CourseDBInterface,
  input: DeleteCardInput
): Promise<DeleteCardOutput> {
  const TOOL_NAME = 'delete_card';
  
  try {
    // Validate input and log start
    const validatedInput = DeleteCardInputSchema.parse(input);
    logToolStart(TOOL_NAME, validatedInput);
    
    // Safety check: require explicit confirmation
    if (!validatedInput.confirm) {
      return {
        cardId: validatedInput.cardId,
        deleted: false,
        message: 'Card deletion requires explicit confirmation. Set confirm: true to proceed.'
      };
    }

    // Verify the card exists before attempting deletion
    let cardExists = true;
    try {
      await courseDB.getCourseDoc(validatedInput.cardId);
    } catch (error) {
      cardExists = false;
    }

    if (!cardExists) {
      return {
        cardId: validatedInput.cardId,
        deleted: false,
        message: `Card not found: ${validatedInput.cardId}`
      };
    }

    // Get card information before deletion for logging
    let cardInfo = '';
    try {
      const cardDoc = await courseDB.getCourseDoc(validatedInput.cardId);
      const cardData = cardDoc as any;
      cardInfo = `Card: ${cardData.shape?.name || 'unknown shape'}`;
    } catch (error) {
      logToolWarning(TOOL_NAME, 'Could not fetch card info before deletion', error);
    }

    // Attempt to delete the card
    try {
      const result = await courseDB.removeCard(validatedInput.cardId);
      
      if (result.ok) {
        const reason = validatedInput.reason ? ` Reason: ${validatedInput.reason}` : '';
        const message = `Card successfully deleted. ${cardInfo}${reason}`;
        
        logToolSuccess(TOOL_NAME, `Card deleted: ${validatedInput.cardId}${reason}`);
        
        return {
          cardId: validatedInput.cardId,
          deleted: true,
          message
        };
      } else {
        return {
          cardId: validatedInput.cardId,
          deleted: false,
          message: `Failed to delete card: ${result.rev || 'Unknown error'}`
        };
      }
    } catch (error) {
      logToolError(TOOL_NAME, `Error deleting card ${validatedInput.cardId}`, error);
      return {
        cardId: validatedInput.cardId,
        deleted: false,
        message: `Failed to delete card: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

  } catch (error) {
    handleToolError(error, TOOL_NAME);
  }
}