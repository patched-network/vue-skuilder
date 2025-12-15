/**
 * FillInView - TUI component for fill-in-the-blank questions
 * Mirrors the Vue fillIn.vue component from courseware
 *
 * Features:
 * - Renders markdown content with blanks
 * - Multiple choice mode (when options provided)
 * - Text input mode (free-form typing)
 * - Spelling feedback on incorrect attempts
 * - Progressive hints after multiple attempts
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import MarkdownRenderer from './MarkdownRenderer.js';
import MultipleChoiceInput from './MultipleChoiceInput.js';
import FillInBlankInput from './FillInBlankInput.js';
import { gradeSpellingAttempt, obscureAnswer } from '../utils/gradeSpellingAttempt.js';
import { TUIQuestion, TUIAnswer } from '../types/study.js';

interface FillInViewProps {
  /** The question data */
  question: TUIQuestion;
  /** Callback when user submits an answer */
  onAnswer: (answer: TUIAnswer) => void;
  /** Difficulty modifier (-200 to 200, affects number of options shown) */
  modifyDifficulty?: number;
}

interface PriorAttempt {
  response: string;
  type: 'text' | 'choice';
}

const FillInView: React.FC<FillInViewProps> = ({ question, onAnswer, modifyDifficulty = 0 }) => {
  const [startTime] = useState(Date.now());
  const [priorAttempts, setPriorAttempts] = useState<PriorAttempt[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Determine if this is a question (has answers) or just content display
  const isQuestion = useMemo(() => {
    return question.answers && question.answers.length > 0;
  }, [question.answers]);

  // Get truncated options based on difficulty modifier
  const truncatedOptions = useMemo(() => {
    if (!question.options) return null;

    const options = [...question.options];

    // If 6 or fewer options, show all
    if (options.length <= 6) {
      return shuffleArray(options);
    }

    // Include one answer
    const answer = question.answers[Math.floor(Math.random() * question.answers.length)];
    const result = [answer];

    // Get distractors (non-answers)
    let distractors = shuffleArray(options.filter((o) => !question.answers.includes(o)));

    // Adjust number of distractors based on difficulty
    if (modifyDifficulty < -200) {
      distractors = distractors.slice(0, 1);
    } else if (modifyDifficulty < -150) {
      distractors = distractors.slice(0, 2);
    } else if (modifyDifficulty < -100) {
      distractors = distractors.slice(0, 3);
    } else if (modifyDifficulty < -50) {
      distractors = distractors.slice(0, 4);
    } else {
      distractors = distractors.slice(0, 5);
    }

    result.push(...distractors);
    return shuffleArray(result);
  }, [question.options, question.answers, modifyDifficulty]);

  // Get a random answer for hints
  const someAnswer = useMemo(() => {
    if (question.answers && question.answers.length > 0) {
      return question.answers[Math.floor(Math.random() * question.answers.length)];
    }
    return '';
  }, [question.answers]);

  // Generate obscured answer based on prior attempts
  const obscuredAnswer = useMemo(() => {
    if (!someAnswer) return '';

    // If there was a text attempt, show spelling feedback
    if (priorAttempts.length > 0 && priorAttempts[0].type === 'text') {
      return gradeSpellingAttempt(priorAttempts[0].response, someAnswer);
    }

    // Otherwise show full obscured version
    return obscureAnswer(someAnswer);
  }, [someAnswer, priorAttempts]);

  // Handle text input submission
  const handleTextAnswer = useCallback(
    (text: string) => {
      if (isSubmitted) return;

      // Check if correct
      const isCorrect = question.answers.some(
        (ans) => ans.toLowerCase().trim() === text.toLowerCase().trim()
      );

      if (!isCorrect && priorAttempts.length < 2) {
        // Allow retry with hint
        setPriorAttempts((prev) => [...prev, { response: text, type: 'text' }]);
        return;
      }

      setIsSubmitted(true);
      const answer: TUIAnswer = {
        questionId: question.id,
        response: text,
        type: 'text',
        timeSpent: Date.now() - startTime,
      };
      onAnswer(answer);
    },
    [question, startTime, onAnswer, isSubmitted, priorAttempts]
  );

  // Handle multiple choice selection
  const handleChoiceAnswer = useCallback(
    (choiceIndex: number) => {
      if (isSubmitted || !truncatedOptions) return;

      setIsSubmitted(true);
      // Pass the actual selected string, not the index
      // (truncatedOptions may be a different array than question.options)
      const selectedText = truncatedOptions[choiceIndex];
      const answer: TUIAnswer = {
        questionId: question.id,
        response: selectedText,
        type: 'choice',
        timeSpent: Date.now() - startTime,
      };
      onAnswer(answer);
    },
    [question.id, startTime, onAnswer, isSubmitted, truncatedOptions]
  );

  // Handle "Next" for non-question content
  const handleNext = useCallback(() => {
    setIsSubmitted(true);
    const answer: TUIAnswer = {
      questionId: question.id,
      response: '',
      type: 'text',
      timeSpent: Date.now() - startTime,
    };
    onAnswer(answer);
  }, [question.id, startTime, onAnswer]);

  return (
    <Box flexDirection="column">
      {/* Question type indicator */}
      <Box marginBottom={1}>
        <Text color="blue">
          {question.isNew ? '📚 New' : '🔄 Review'}
          {' | '}
          {question.options ? 'Multiple Choice' : 'Fill in the Blank'}
        </Text>
      </Box>

      {/* Markdown content */}
      <Box marginBottom={1}>
        <MarkdownRenderer content={question.content} />
      </Box>

      {/* Prior attempt feedback */}
      {priorAttempts.length === 1 && (
        <Box marginBottom={1} flexDirection="column">
          <Text color="yellow">Hint - letter positions:</Text>
          <Box marginLeft={2}>
            <Text bold color="cyan">
              {obscuredAnswer}
            </Text>
          </Box>
        </Box>
      )}

      {priorAttempts.length === 2 && (
        <Box marginBottom={1} flexDirection="column">
          <Text color="yellow">Answer:</Text>
          <Box marginLeft={2}>
            <Text bold color="green">
              {someAnswer}
            </Text>
          </Box>
        </Box>
      )}

      {/* Input component based on question type */}
      {isQuestion ? (
        truncatedOptions ? (
          <MultipleChoiceInput options={truncatedOptions} onSelect={handleChoiceAnswer} />
        ) : (
          <FillInBlankInput
            onSubmit={handleTextAnswer}
            placeholder={
              priorAttempts.length > 0 ? 'Try again...' : 'Type your answer...'
            }
            resetKey={priorAttempts.length}
            showSubmittedState={false}
          />
        )
      ) : (
        // Non-question content - just show Next button equivalent
        <Box marginTop={1}>
          <Text color="gray">Press Enter to continue...</Text>
          <FillInBlankInput onSubmit={handleNext} placeholder="" />
        </Box>
      )}

      {/* Help text */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {truncatedOptions
            ? 'Use arrow keys to navigate, Enter to select'
            : priorAttempts.length > 0
              ? `Attempt ${priorAttempts.length + 1}/3 - Type your answer and press Enter`
              : 'Type your answer and press Enter'}
        </Text>
      </Box>
    </Box>
  );
};

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default FillInView;
