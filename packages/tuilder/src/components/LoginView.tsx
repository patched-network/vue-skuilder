import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface LoginViewProps {
  onLogin: (user: string, pass: string) => void;
}

type FocusableInput = 'username' | 'password';

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [focusedInput, setFocusedInput] = useState<FocusableInput>('username');

  const handleUsernameSubmit = () => {
    setFocusedInput('password');
  };

  const handlePasswordSubmit = () => {
    onLogin(username, password);
  };

  return (
    <Box flexDirection="column">
      <Text>Login</Text>
      <Box>
        <Text>Username: </Text>
        <TextInput
          value={username}
          onChange={setUsername}
          onSubmit={handleUsernameSubmit}
          focus={focusedInput === 'username'}
        />
      </Box>
      <Box>
        <Text>Password: </Text>
        <TextInput
          value={password}
          onChange={setPassword}
          onSubmit={handlePasswordSubmit}
          mask="*"
          focus={focusedInput === 'password'}
        />
      </Box>
    </Box>
  );
};

export default LoginView;
