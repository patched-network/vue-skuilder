import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface SignupViewProps {
  onSignup: (user: string, pass: string) => void;
}

const SignupView: React.FC<SignupViewProps> = ({ onSignup }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    onSignup(username, password);
  };

  return (
    <Box flexDirection="column">
      <Text>Sign Up</Text>
      <Box>
        <Text>Username: </Text>
        <TextInput value={username} onChange={setUsername} />
      </Box>
      <Box>
        <Text>Password: </Text>
        <TextInput value={password} onChange={setPassword} onSubmit={handleSubmit} mask="*" />
      </Box>
    </Box>
  );
};

export default SignupView;
