import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface FillInBlankInputProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
  /** Reset key - change this to reset the input state (e.g., for retries) */
  resetKey?: number | string;
  /** Whether to show the "submitted" state or stay interactive */
  showSubmittedState?: boolean;
}

const FillInBlankInput: React.FC<FillInBlankInputProps> = ({
  onSubmit,
  placeholder = 'Type your answer...',
  resetKey = 0,
  showSubmittedState = true,
}) => {
  const [value, setValue] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Reset state when resetKey changes
  useEffect(() => {
    setValue('');
    setIsSubmitted(false);
  }, [resetKey]);

  const handleSubmit = (text: string) => {
    if (isSubmitted) return;

    if (showSubmittedState) {
      setIsSubmitted(true);
    }
    onSubmit(text.trim());

    // If not showing submitted state, clear for next entry
    if (!showSubmittedState) {
      setValue('');
    }
  };

  if (isSubmitted && showSubmittedState) {
    return (
      <Box>
        <Text color="green">Answer submitted: "{value}"</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        Your answer:
      </Text>
      <Box marginTop={1}>
        <Text color="blue">❯ </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      </Box>
    </Box>
  );
};

export default FillInBlankInput;
