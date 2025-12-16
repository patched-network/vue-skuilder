import { getDataLayer } from '@vue-skuilder/db';
import { SessionController } from '@vue-skuilder/db';
import { StudyContentSource, StudySessionItem, getStudySource } from '@vue-skuilder/db';
import { BlanksCard } from '@vue-skuilder/courseware/logic';
import { gradeSpellingAttempt } from '../utils/gradeSpellingAttempt.js';

import {
  TUIQuestion,
  TUIAnswer,
  AnswerFeedback,
  StudySession,
  StudyConfig,
  ViewData,
} from '../types/study.js';

/**
 * Hydrated card structure returned by SessionController.nextCard()
 * Contains the session item, view component (null for TUI), and ViewData
 */
interface HydratedCard {
  item: StudySessionItem;
  view: null;
  data: ViewData[];
}

export class StudyService {
  private sessionController: SessionController<null> | null = null;
  private currentSession: StudySession | null = null;
  private studySources: StudyContentSource[] = [];

  /**
   * Initialize a new study session
   */
  async initializeSession(config: StudyConfig): Promise<StudySession> {
    const dataLayer = getDataLayer();
    const userDB = dataLayer.getUserDB();

    // Create study content sources for each course
    this.studySources = await Promise.all(
      config.courseIds.map((courseId) => getStudySource({ type: 'course', id: courseId }, userDB))
    );

    // Initialize session controller
    // TUI doesn't use view components - pass noop function
    const noopGetViewComponent = (_viewId: string): null => null;

    this.sessionController = new SessionController<null>(
      this.studySources,
      config.durationSeconds,
      dataLayer,
      noopGetViewComponent
    );
    await this.sessionController.prepareSession();

    // Initialize session state
    this.currentSession = {
      progress: {
        currentQuestion: 0,
        totalQuestions: 0, // Will be updated as questions are fetched
        correctAnswers: 0,
        incorrectAnswers: 0,
        currentStreak: 0,
        timeRemaining: config.durationSeconds,
        startTime: new Date(),
      },
      currentQuestion: null,
      isActive: true,
      isComplete: false,
    };

    // Get first question
    await this.nextQuestion();

    return this.currentSession;
  }

  /**
   * Get the next question in the session
   */
  async nextQuestion(): Promise<TUIQuestion | null> {
    if (!this.sessionController || !this.currentSession) {
      throw new Error('Study session not initialized');
    }

    // Get next hydrated card from session controller
    // First call with no action, subsequent calls happen in submitAnswer
    const hydratedCard = await this.sessionController.nextCard();

    if (!hydratedCard) {
      // Session is complete
      this.currentSession.isComplete = true;
      this.currentSession.isActive = false;
      this.currentSession.report = this.sessionController.report;
      return null;
    }

    // Update progress
    this.currentSession.progress.currentQuestion += 1;
    this.currentSession.progress.timeRemaining = this.sessionController.secondsRemaining;

    try {
      // Parse the hydrated card data into a TUIQuestion
      const question = this.parseQuestionData(hydratedCard);
      this.currentSession.currentQuestion = question;
      return question;
    } catch (error) {
      console.error('[StudyService] Failed to parse question data:', error);
      // Skip this question and try the next one
      return this.nextQuestion();
    }
  }

  /**
   * Submit an answer and get feedback
   *
   * @claude [1023] TODO: Answer grading logic here duplicates @packages/courseware/src/default/questions/fillIn/fillIn.vue
   * Consider: Extract to shared `BlanksCard.grade()` utility or use a QuestionController pattern
   */
  async submitAnswer(answer: TUIAnswer): Promise<AnswerFeedback> {
    if (!this.currentSession?.currentQuestion) {
      throw new Error('No current question to answer');
    }

    const question = this.currentSession.currentQuestion;
    let isCorrect = false;
    let spellingFeedback: string | undefined;

    try {
      // Create BlanksCard instance to use its grading logic
      // @claude [1023] DUPLICATED pattern from: @packages/courseware/src/default/questions/fillIn/fillIn.vue line 222
      const blanksCard = new BlanksCard(question.viewData);

      // Both text and choice answers are now strings
      // (FillInView passes the selected text, not an index)
      const formattedAnswer = answer.response as string;

      isCorrect = blanksCard.isCorrect(formattedAnswer);

      // For text answers, provide spelling feedback if incorrect
      if (!isCorrect && answer.type === 'text' && question.answers.length > 0) {
        const correctAnswer = question.answers[0];
        spellingFeedback = gradeSpellingAttempt(answer.response as string, correctAnswer);
      }
    } catch (error) {
      console.error('[StudyService] Error grading answer:', error);
      // Fallback to simple string comparison (works for both text and choice)
      isCorrect = question.answers.includes(answer.response as string);
    }

    // Update session progress
    if (isCorrect) {
      this.currentSession.progress.correctAnswers += 1;
      this.currentSession.progress.currentStreak += 1;
    } else {
      this.currentSession.progress.incorrectAnswers += 1;
      this.currentSession.progress.currentStreak = 0;
    }

    const feedback: AnswerFeedback = {
      isCorrect,
      message: isCorrect ? 'Correct!' : 'Incorrect',
      spellingFeedback,
      correctAnswers: question.answers,
    };

    // Tell session controller about the result - this dismisses current card
    // The next call to nextQuestion() will get the next card
    if (this.sessionController) {
      const action = isCorrect ? 'dismiss-success' : 'marked-failed';
      await this.sessionController.nextCard(action);
    }

    return feedback;
  }

  /**
   * Get current session state
   */
  getCurrentSession(): StudySession | null {
    return this.currentSession;
  }

  /**
   * End the current session
   */
  endSession(): void {
    if (this.currentSession) {
      this.currentSession.isActive = false;
      this.currentSession.isComplete = true;
    }
  }

  /**
   * Parse hydrated card data into a TUIQuestion
   * The HydratedCard.data already contains ViewData[] from CardHydrationService
   *
   * @claude [1023] NOTE: This mimics the logic from @packages/courseware/src/default/questions/fillIn/fillIn.vue
   * where it uses BlanksCard to parse question content. Consider if this can be unified.
   */
  private parseQuestionData(hydratedCard: HydratedCard): TUIQuestion {
    const { item, data } = hydratedCard;

    // data is ViewData[] - use it directly to create BlanksCard
    const viewData: ViewData[] = data;

    // Create BlanksCard to parse the question
    // @claude [1023] DUPLICATED pattern from: @packages/courseware/src/default/questions/fillIn/fillIn.vue lines 85-95
    const blanksCard = new BlanksCard(viewData);

    // Determine question type
    const questionType = blanksCard.options ? 'multiple-choice' : 'fill-in-blank';

    return {
      id: item.cardID,
      courseId: item.courseID,
      type: questionType,
      content: blanksCard.mdText,
      options: blanksCard.options,
      answers: blanksCard.answers || [],
      isNew: item.status === 'new',
      sessionItem: item,
      viewData,
    };
  }
}

// Export singleton instance
export const studyService = new StudyService();
