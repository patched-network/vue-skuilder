import { StudySessionItem } from '@vue-skuilder/db';

/**
 * ViewData represents the data structure that questions receive
 * Contains field data indexed by field name (e.g., "Input", "Uploads")
 */
export type ViewData = Record<string, unknown>;

/**
 * Question data structure optimized for terminal rendering
 */
export interface TUIQuestion {
  /** Unique identifier for the question */
  id: string;
  /** Course this question belongs to */
  courseId: string;
  /** Question type (fill-in-blank, multiple-choice, etc.) */
  type: 'fill-in-blank' | 'multiple-choice' | 'unknown';
  /** Markdown content of the question */
  content: string;
  /** Available answer options (null for fill-in-blank) */
  options: string[] | null;
  /** Correct answers */
  answers: string[];
  /** Whether this is a new card or review */
  isNew: boolean;
  /** Original session item data */
  sessionItem: StudySessionItem;
  /** Raw view data from database */
  viewData: ViewData[];
}

/**
 * User's answer to a question
 */
export interface TUIAnswer {
  /** The question ID this answer is for */
  questionId: string;
  /** User's response - string for fill-in, number for multiple choice index */
  response: string | number;
  /** Type of response */
  type: 'text' | 'choice';
  /** Time spent on question in milliseconds */
  timeSpent: number;
}

/**
 * Feedback for a submitted answer
 */
export interface AnswerFeedback {
  /** Whether the answer was correct */
  isCorrect: boolean;
  /** Feedback message to display */
  message: string;
  /** For spelling questions, character-by-character feedback */
  spellingFeedback?: string;
  /** Correct answer(s) to show */
  correctAnswers: string[];
}

/**
 * Study session progress and statistics
 */
export interface StudyProgress {
  /** Current question number (1-based) */
  currentQuestion: number;
  /** Total questions in session */
  totalQuestions: number;
  /** Questions answered correctly */
  correctAnswers: number;
  /** Questions answered incorrectly */
  incorrectAnswers: number;
  /** Current streak of correct answers */
  currentStreak: number;
  /** Time remaining in session (seconds) */
  timeRemaining: number;
  /** Session start time */
  startTime: Date;
}

/**
 * Study session state
 */
export interface StudySession {
  /** Session progress data */
  progress: StudyProgress;
  /** Current question being displayed */
  currentQuestion: TUIQuestion | null;
  /** Whether session is active */
  isActive: boolean;
  /** Whether session has been completed */
  isComplete: boolean;
  /** Session completion report */
  report?: string;
}

/**
 * Configuration for study session
 */
export interface StudyConfig {
  /** Session duration in seconds */
  durationSeconds: number;
  /** Maximum number of new cards to include */
  maxNewCards: number;
  /** Course IDs to study from */
  courseIds: string[];
}
