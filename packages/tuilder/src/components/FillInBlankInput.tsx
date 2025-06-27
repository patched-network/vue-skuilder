import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface FillInBlankInputProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
}

const FillInBlankInput: React.FC<FillInBlankInputProps> = ({
  onSubmit,
  placeholder = 'Type your answer...'
}) => {
  const [value, setValue] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (text: string) => {
    if (isSubmitted || text.trim() === '') return;

    setIsSubmitted(true);
    onSubmit(text.trim());
  };

  if (isSubmitted) {
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
