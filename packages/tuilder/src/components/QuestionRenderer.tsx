import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { TUIQuestion, TUIAnswer } from '../types/study.js';
import MarkdownRenderer from './MarkdownRenderer.js';
import MultipleChoiceInput from './MultipleChoiceInput.js';
import FillInBlankInput from './FillInBlankInput.js';

interface QuestionRendererProps {
  question: TUIQuestion;
  onAnswer: (answer: TUIAnswer) => void;
}

const QuestionRenderer: React.FC<QuestionRendererProps> = ({ question, onAnswer }) => {
  const [startTime] = useState(Date.now());

  const handleTextAnswer = (text: string) => {
    const answer: TUIAnswer = {
      questionId: question.id,
      response: text,
      type: 'text',
      timeSpent: Date.now() - startTime,
    };
    onAnswer(answer);
  };

  const handleChoiceAnswer = (choiceIndex: number) => {
    const answer: TUIAnswer = {
      questionId: question.id,
      response: choiceIndex,
      type: 'choice',
      timeSpent: Date.now() - startTime,
    };
    onAnswer(answer);
  };

  return (
    <Box flexDirection="column">
      {/* Question Type Indicator */}
      <Box marginBottom={1}>
        <Text color="blue">
          {question.isNew ? '📚 New' : '🔄 Review'} |
          {question.type === 'multiple-choice' ? ' Multiple Choice' : ' Fill in the Blank'}
        </Text>
      </Box>

      {/* Question Content */}
      <Box marginBottom={1}>
        <MarkdownRenderer content={question.content} />
      </Box>

      {/* Input Component based on question type */}
      {question.type === 'multiple-choice' && question.options ? (
        <MultipleChoiceInput options={question.options} onSelect={handleChoiceAnswer} />
      ) : (
        <FillInBlankInput onSubmit={handleTextAnswer} />
      )}

      {/* Help text */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {question.type === 'multiple-choice'
            ? 'Use arrow keys to navigate, Enter to select'
            : 'Type your answer and press Enter'}
        </Text>
      </Box>
    </Box>
  );
};

export default QuestionRenderer;
