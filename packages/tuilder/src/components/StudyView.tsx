import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { studyService } from '../services/study.js';
import { StudySession, StudyConfig, TUIQuestion, TUIAnswer } from '../types/study.js';
import QuestionRenderer from './QuestionRenderer.js';
import ProgressDisplay from './ProgressDisplay.js';
import Spinner from './Spinner.js';

interface StudyViewProps {
  config: StudyConfig;
  onComplete: (report: string) => void;
  onError: (error: string) => void;
}

const StudyView: React.FC<StudyViewProps> = ({ config, onComplete, onError }) => {
  const [session, setSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<TUIQuestion | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<string>('');

  // Initialize study session
  useEffect(() => {
    const initSession = async () => {
      try {
        setLoading(true);
        const newSession = await studyService.initializeSession(config);
        setSession(newSession);
        setCurrentQuestion(newSession.currentQuestion);
        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize study session:', error);
        onError(`Failed to start study session: ${error}`);
        setLoading(false);
      }
    };

    initSession();
  }, [config, onError]);

  // Update session state periodically
  useEffect(() => {
    if (!session?.isActive) return;

    const interval = setInterval(() => {
      const currentSession = studyService.getCurrentSession();
      if (currentSession) {
        setSession({ ...currentSession });

        // Check if session is complete
        if (currentSession.isComplete) {
          onComplete(currentSession.report || 'Study session completed');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.isActive, onComplete]);

  const handleAnswer = async (answer: TUIAnswer) => {
    if (!currentQuestion || !session) return;

    try {
      // Submit answer and get feedback
      const feedback = await studyService.submitAnswer(answer);

      // Show feedback briefly
      setLastFeedback(
        feedback.isCorrect
          ? '✓ Correct!'
          : `✗ Incorrect. ${feedback.spellingFeedback ? `Hint: ${feedback.spellingFeedback}` : `Correct answer: ${feedback.correctAnswers.join(', ')}`}`
      );
      setShowFeedback(true);

      // After showing feedback, move to next question
      setTimeout(async () => {
        setShowFeedback(false);

        try {
          const nextQuestion = await studyService.nextQuestion();
          setCurrentQuestion(nextQuestion);

          // Update session state
          const updatedSession = studyService.getCurrentSession();
          if (updatedSession) {
            setSession({ ...updatedSession });
          }
        } catch (error) {
          console.error('Failed to get next question:', error);
          onError(`Failed to load next question: ${error}`);
        }
      }, 2000);

    } catch (error) {
      console.error('Failed to submit answer:', error);
      onError(`Failed to submit answer: ${error}`);
    }
  };

  if (loading) {
    return (
      <Box flexDirection="column" alignItems="center">
        <Spinner />
        <Text>Initializing study session...</Text>
      </Box>
    );
  }

  if (!session) {
    return (
      <Box>
        <Text color="red">Failed to initialize study session</Text>
      </Box>
    );
  }

  if (session.isComplete) {
    return (
      <Box flexDirection="column" alignItems="center">
        <Text color="green">Study Session Complete!</Text>
        <Text>{session.report}</Text>
        <Text>
          Correct: {session.progress.correctAnswers} |
          Incorrect: {session.progress.incorrectAnswers} |
          Streak: {session.progress.currentStreak}
        </Text>
      </Box>
    );
  }

  if (showFeedback) {
    return (
      <Box flexDirection="column" alignItems="center">
        <ProgressDisplay progress={session.progress} />
        <Box marginY={1}>
          <Text color={lastFeedback.startsWith('✓') ? 'green' : 'red'}>
            {lastFeedback}
          </Text>
        </Box>
      </Box>
    );
  }

  if (!currentQuestion) {
    return (
      <Box flexDirection="column" alignItems="center">
        <ProgressDisplay progress={session.progress} />
        <Text>No more questions available</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <ProgressDisplay progress={session.progress} />
      <QuestionRenderer
        question={currentQuestion}
        onAnswer={handleAnswer}
      />
    </Box>
  );
};

export default StudyView;
