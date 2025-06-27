import { getDataLayer } from '@vue-skuilder/db';
import { SessionController } from '@vue-skuilder/db';
import { StudyContentSource, StudySessionItem, getStudySource } from '@vue-skuilder/db';
// Temporarily removing courses dependency due to ESM/CSS conflicts
// import { BlanksCard, gradeSpellingAttempt } from '@vue-skuilder/courses';
// import { Answer } from '@vue-skuilder/common';

import {
  TUIQuestion,
  TUIAnswer,
  AnswerFeedback,
  StudySession,
  StudyConfig,
  ViewData,
} from '../types/study.js';

export class StudyService {
  private sessionController: SessionController | null = null;
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
    this.sessionController = new SessionController(this.studySources, config.durationSeconds);
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

    const sessionItem = this.sessionController.nextCard();

    if (!sessionItem) {
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
      // Fetch the actual card data
      const question = await this.fetchQuestionData(sessionItem);
      this.currentSession.currentQuestion = question;
      return question;
    } catch (error) {
      console.error('Failed to fetch question data:', error);
      // Skip this question and try the next one
      return this.nextQuestion();
    }
  }

  /**
   * Submit an answer and get feedback
   */
  async submitAnswer(answer: TUIAnswer): Promise<AnswerFeedback> {
    if (!this.currentSession?.currentQuestion) {
      throw new Error('No current question to answer');
    }

    const question = this.currentSession.currentQuestion;
    let isCorrect = false;
    let spellingFeedback: string | undefined;

    // Simplified grading logic without BlanksCard dependency
    if (answer.type === 'text') {
      isCorrect = question.answers.includes(answer.response as string);
      
      // Simple spelling feedback without gradeSpellingAttempt
      if (!isCorrect && question.answers.length > 0) {
        const correctAnswer = question.answers[0];
        const userAnswer = answer.response as string;
        if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
          spellingFeedback = `Close! Check your capitalization.`;
        } else {
          spellingFeedback = `The correct answer is: ${correctAnswer}`;
        }
      }
    } else if (answer.type === 'choice' && question.options) {
      const selectedOption = question.options[answer.response as number];
      isCorrect = question.answers.includes(selectedOption);
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

    // Tell session controller about the result
    if (this.sessionController) {
      const action = isCorrect ? 'dismiss-success' : 'marked-failed';
      this.sessionController.nextCard(action);
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
   * Fetch and parse question data from a session item
   */
  private async fetchQuestionData(sessionItem: StudySessionItem): Promise<TUIQuestion> {
    const dataLayer = getDataLayer();

    // Get course database
    const courseDB = dataLayer.getCourseDB(sessionItem.courseID);

    // Fetch card data - need to access the underlying PouchDB instance
    const cardDoc = await (courseDB as any).db.get(sessionItem.cardID);

    // Fetch displayable data for the card
    const displayableDataIds = cardDoc.id_displayable_data;
    if (!displayableDataIds || displayableDataIds.length === 0) {
      throw new Error(`No displayable data found for card ${sessionItem.cardID}`);
    }

    // Get the first displayable data document
    const displayableDoc = await (courseDB as any).db.get(displayableDataIds[0]);

    // Convert to ViewData format
    const viewData: ViewData[] = [
      displayableDoc.data.reduce((acc: ViewData, field: any) => {
        acc[field.name] = field.data;
        return acc;
      }, {}),
    ];

    // Simple question parsing without BlanksCard
    // Look for multiple choice options in the content
    const content = String(viewData[0]?.content || '');
    const hasOptions = content.includes('{{') && content.includes('||');
    const questionType = hasOptions ? 'multiple-choice' : 'fill-in-blank';
    
    // Extract basic answers from content
    let answers: string[] = [];
    let options: string[] | null = null;
    
    if (hasOptions) {
      // Extract options from {{option1||option2||option3}} format
      const optionMatch = content.match(/\{\{([^}]+)\}\}/);
      if (optionMatch) {
        options = optionMatch[1].split('||').map((opt: string) => opt.trim());
        answers = options ? [options[0]] : []; // First option is usually correct
      }
    } else {
      // Extract answer from {{answer}} format
      const answerMatch = content.match(/\{\{([^}]+)\}\}/);
      if (answerMatch) {
        answers = [answerMatch[1].trim()];
      }
    }

    return {
      id: sessionItem.cardID,
      courseId: sessionItem.courseID,
      type: questionType,
      content: content,
      options: options,
      answers: answers,
      isNew: sessionItem.status === 'new',
      sessionItem,
      viewData,
    };
  }
}

// Export singleton instance
export const studyService = new StudyService();
