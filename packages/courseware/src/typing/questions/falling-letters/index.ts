// vue/src/courses/typing/questions/falling-letters/index.ts
import FallingLettersView from './FallingLetters.vue';
import { FallingLettersQuestion } from './FallingLettersQuestion';

// Set the views on the class after import to avoid circular dependency
FallingLettersQuestion.views = [FallingLettersView];

// Re-export everything
export * from './FallingLettersQuestion';