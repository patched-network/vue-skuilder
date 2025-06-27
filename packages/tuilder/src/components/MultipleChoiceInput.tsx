import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

interface MultipleChoiceInputProps {
  options: string[];
  onSelect: (selectedIndex: number) => void;
}

const MultipleChoiceInput: React.FC<MultipleChoiceInputProps> = ({ options, onSelect }) => {
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Convert options to the format expected by ink-select-input
  const items = options.map((option, index) => ({
    label: option,
    value: index,
  }));

  const handleSelect = (item: { label: string; value: number }) => {
    if (isSubmitted) return;

    setIsSubmitted(true);
    onSelect(item.value);
  };

  if (isSubmitted) {
    return (
      <Box>
        <Text color="green">Answer submitted...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        Choose your answer:
      </Text>
      <Box marginTop={1}>
        <SelectInput items={items} onSelect={handleSelect} />
      </Box>
    </Box>
  );
};

export default MultipleChoiceInput;
