import { Text } from 'ink';
import Spinner from 'ink-spinner';

const LoadingSpinner = () => (
  <Text>
    <Spinner type="dots" /> Loading...
  </Text>
);

export default LoadingSpinner;
