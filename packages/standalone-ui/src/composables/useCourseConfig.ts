import { ref, readonly } from 'vue';
import config from '../../skuilder.config.json';

// This would be replaced by actual course configuration in a real implementation
const defaultConfig = {
  title: config.title ? config.title : '[UNSET] Course Title',
  description: 'Course Description',
  logo: '',
  darkMode: false,
  links: [
    { text: 'About', url: '/about' },
    { text: 'Help', url: '/help' },
  ],
  copyright: '',
};

export function useCourseConfig() {
  const courseConfig = ref(defaultConfig);

  // Later this would load from a configuration file or API
  const loadConfig = async () => {
    // In a real implementation, this would load configuration
    // courseConfig.value = await loadCourseConfig();
  };

  // Initialize
  loadConfig();

  return {
    courseConfig: readonly(courseConfig),
    loadConfig,
  };
}
