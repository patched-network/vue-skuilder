import { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import LoginView from './components/LoginView.js';
import SignupView from './components/SignupView.js';
import LoadingSpinner from './components/Spinner.js';
import StudyView from './components/StudyView.js';
import * as auth from './services/auth.js';
import { StudyConfig } from './types/study.js';

type View = 'loading' | 'login' | 'signup' | 'study' | 'complete' | 'error';

const App = () => {
  const [view, setView] = useState<View>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [completionReport, setCompletionReport] = useState<string>('');

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

  const handleStudyComplete = (report: string) => {
    setCompletionReport(report);
    setView('complete');
  };

  const handleStudyError = (error: string) => {
    setErrorMessage(error);
    setView('error');
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

  if (view === 'study') {
    const studyConfig: StudyConfig = {
      durationSeconds: 1200, // 20 minutes
      maxNewCards: 10,
      courseIds: ['default'], // TODO: get from user preferences
    };

    return (
      <StudyView config={studyConfig} onComplete={handleStudyComplete} onError={handleStudyError} />
    );
  }

  if (view === 'complete') {
    return (
      <Box flexDirection="column" alignItems="center">
        <Text color="green" bold>
          Study Session Complete!
        </Text>
        <Text>{completionReport}</Text>
        <Box marginTop={2}>
          <Text color="blue">Press Ctrl+C to exit or start a new session</Text>
        </Box>
      </Box>
    );
  }

  if (view === 'error') {
    return (
      <Box flexDirection="column" alignItems="center">
        <Text color="red" bold>
          Error
        </Text>
        <Text>{errorMessage}</Text>
        <Box marginTop={2}>
          <Text color="blue">Press Ctrl+C to exit</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Text>Welcome to the study session!</Text>
    </Box>
  );
};

render(<App />);
