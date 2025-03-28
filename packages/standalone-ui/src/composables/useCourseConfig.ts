import { ref, readonly } from 'vue';

// This would be replaced by actual course configuration in a real implementation
const defaultConfig = {
  title: 'Course Title',
  description: 'Course Description',
  logo: '/logo.png',
  darkMode: false,
  links: [
    { text: 'About', url: '/about' },
    { text: 'Help', url: '/help' }
  ],
  copyright: '© 2025 Skuilder'
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
    loadConfig
  };
}
