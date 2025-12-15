import React from 'react';
import { TUIQuestion, TUIAnswer } from '../types/study.js';
import FillInView from './FillInView.js';

interface QuestionRendererProps {
  question: TUIQuestion;
  onAnswer: (answer: TUIAnswer) => void;
}

/**
 * QuestionRenderer - Routes questions to appropriate view components
 *
 * Currently supports:
 * - fill-in-blank: FillInView (text input with retry/hints)
 * - multiple-choice: FillInView (uses radio selection)
 *
 * Future: Add routing for other question types (chess puzzles, etc.)
 */
const QuestionRenderer: React.FC<QuestionRendererProps> = ({ question, onAnswer }) => {
  // For now, all supported question types use FillInView
  // FillInView handles both text input and multiple choice modes
  return <FillInView question={question} onAnswer={onAnswer} />;
};

export default QuestionRenderer;
