import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface LoginViewProps {
  onLogin: (user: string, pass: string) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    onLogin(username, password);
  };

  return (
    <Box flexDirection="column">
      <Text>Login</Text>
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

export default LoginView;
