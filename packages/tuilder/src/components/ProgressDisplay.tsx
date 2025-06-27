import React from 'react';
import { Box, Text } from 'ink';
import { StudyProgress } from '../types/study.js';

interface ProgressDisplayProps {
  progress: StudyProgress;
}

const ProgressDisplay: React.FC<ProgressDisplayProps> = ({ progress }) => {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStreakColor = (streak: number): string => {
    if (streak >= 5) return 'green';
    if (streak >= 3) return 'yellow';
    return 'white';
  };

  const getTimeColor = (timeRemaining: number): string => {
    if (timeRemaining <= 60) return 'red';
    if (timeRemaining <= 300) return 'yellow';
    return 'green';
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box justifyContent="space-between">
        <Text>
          Question {progress.currentQuestion} of {progress.totalQuestions || '?'}
        </Text>
        <Text color={getTimeColor(progress.timeRemaining)}>
          Time: {formatTime(progress.timeRemaining)}
        </Text>
      </Box>

      <Box justifyContent="space-between">
        <Text>
          ✓ {progress.correctAnswers} | ✗ {progress.incorrectAnswers}
        </Text>
        <Text color={getStreakColor(progress.currentStreak)}>
          Streak: {progress.currentStreak}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">{'─'.repeat(60)}</Text>
      </Box>
    </Box>
  );
};

export default ProgressDisplay;
