import { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import LoginView from './components/LoginView.js';
import SignupView from './components/SignupView.js';
import LoadingSpinner from './components/Spinner.js';
import * as auth from './services/auth.js';

type View = 'loading' | 'login' | 'signup' | 'study';

const App = () => {
  const [view, setView] = useState<View>('loading');

  useEffect(() => {
    const checkSession = async () => {
      await auth.initialize();
      if (await auth.isLoggedIn()) {
        setView('study');
      } else {
        setView('login');
      }
    };
    checkSession();
  }, []);

  const handleLogin = async (user: string, pass: string) => {
    setView('loading');
    const success = await auth.login(user, pass);
    if (success) {
      setView('study');
    } else {
      setView('login'); // Or show an error message
    }
  };

  const handleSignup = async (user: string, pass: string) => {
    setView('loading');
    const success = await auth.signup(user, pass);
    if (success) {
      setView('study');
    } else {
      setView('signup'); // Or show an error message
    }
  };

  if (view === 'loading') {
    return <LoadingSpinner />;
  }

  if (view === 'login') {
    return <LoginView onLogin={handleLogin} />;
  }

  if (view === 'signup') {
    return <SignupView onSignup={handleSignup} />;
  }

  return (
    <Box>
      <Text>Welcome to the study session!</Text>
    </Box>
  );
};

render(<App />);