import ENV from './ENVIRONMENT_VARS';
import '@mdi/font/css/materialdesignicons.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

// Vuetify
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

// data layer
import { initializeDataLayer, getDataLayer } from '@vue-skuilder/db';

// auth store
import { useAuthStore } from '@vue-skuilder/common-ui';

// styles from component library packages
import '@vue-skuilder/courses/style';
import '@vue-skuilder/common-ui/style';

// Import allCourses singleton and exampleCourse
import { allCourses } from '@vue-skuilder/courses';
import { exampleCourse } from './questions/exampleCourse';

// Add the example course to the allCourses singleton
allCourses.courses.push(exampleCourse);

// theme configuration
import config from '../skuilder.config.json';

(async () => {
  // For static data layer, load manifest
  let dataLayerOptions: any = {
    COUCHDB_SERVER_URL: ENV.COUCHDB_SERVER_URL,
    COUCHDB_SERVER_PROTOCOL: ENV.COUCHDB_SERVER_PROTOCOL,
    COURSE_IDS: [config.course ? config.course : 'default-course'],
  };

  if (config.dataLayerType === 'static') {
    // Load manifest for static mode
    const courseId = config.course;
    if (!courseId) {
      throw new Error('Course ID required for static data layer');
    }

    try {
      const manifestResponse = await fetch(`/static-courses/${courseId}/manifest.json`);
      if (!manifestResponse.ok) {
        throw new Error(
          `Failed to load manifest: ${manifestResponse.status} ${manifestResponse.statusText}`
        );
      }
      const manifest = await manifestResponse.json();
      console.log(`Loaded manifest for course ${courseId}`);
      console.log(JSON.stringify(manifest));

      dataLayerOptions = {
        staticContentPath: '/static-courses',
        manifests: {
          [courseId]: manifest,
        },
      };
    } catch (error) {
      console.error('[DEBUG] Failed to load course manifest:', error);
      throw new Error(`Could not load course manifest for ${courseId}: ${error}`);
    }
  }

  try {
    await initializeDataLayer({
      type: (config.dataLayerType || 'couch') as 'couch' | 'static',
      options: dataLayerOptions,
    });
    console.log('[DEBUG] Data layer initialized successfully');
  } catch (error) {
    console.error('[DEBUG] Data layer initialization failed:', error);
    throw error;
  }
  const pinia = createPinia();

  // Apply theme configuration from skuilder.config.json
  const themeConfig = config.theme
    ? {
        defaultTheme: config.theme.defaultMode || 'light',
        themes: {
          light: config.theme.light,
          dark: config.theme.dark,
        },
      }
    : {
        defaultTheme: 'light',
        themes: {
          light: {
            dark: false,
            colors: {
              primary: '#1976D2',
              secondary: '#424242',
              accent: '#82B1FF',
              error: '#F44336',
              info: '#2196F3',
              success: '#4CAF50',
              warning: '#FF9800',
              background: '#FFFFFF',
              surface: '#FFFFFF',
              'surface-bright': '#FFFFFF',
              'surface-light': '#EEEEEE',
              'surface-variant': '#E3F2FD',
              'on-surface-variant': '#1976D2',
              'primary-darken-1': '#1565C0',
              'secondary-darken-1': '#212121',
              'on-primary': '#FFFFFF',
              'on-secondary': '#FFFFFF',
              'on-background': '#212121',
              'on-surface': '#212121',
            },
          },
          dark: {
            dark: true,
            colors: {
              primary: '#2196F3',
              secondary: '#90A4AE',
              accent: '#82B1FF',
              error: '#FF5252',
              info: '#2196F3',
              success: '#4CAF50',
              warning: '#FFC107',
              background: '#121212',
              surface: '#1E1E1E',
              'surface-bright': '#2C2C2C',
              'surface-light': '#2C2C2C',
              'surface-variant': '#1A237E',
              'on-surface-variant': '#82B1FF',
              'primary-darken-1': '#1976D2',
              'secondary-darken-1': '#546E7A',
              'on-primary': '#000000',
              'on-secondary': '#000000',
              'on-background': '#FFFFFF',
              'on-surface': '#FFFFFF',
            },
          },
        },
      };

  const vuetify = createVuetify({
    components,
    directives,
    theme: themeConfig,
    icons: {
      defaultSet: 'mdi',
      aliases,
      sets: {
        mdi,
      },
    },
  });

  const app = createApp(App);

  app.use(router);
  app.use(vuetify);
  app.use(pinia);

  const { piniaPlugin } = await import('@vue-skuilder/common-ui');
  app.use(piniaPlugin, { pinia });

  await useAuthStore().init();
  
  // Initialize config store to load user settings (including dark mode)
  const { useConfigStore } = await import('@vue-skuilder/common-ui');
  await useConfigStore().init();

  // Auto-register user for the course in standalone mode
  if (config.course) {
    try {
      const authStore = useAuthStore();
      const user = getDataLayer().getUserDB();
      
      // Check if user is already registered for the course
      const courseRegistrations = await user.getCourseRegistrationsDoc();
      const isRegistered = courseRegistrations.courses.some(c => c.courseID === config.course);
      
      if (!isRegistered) {
        console.log(`[Standalone] Auto-registering user for course: ${config.course}`);
        await user.registerForCourse(config.course, false); // non-preview mode
        console.log(`[Standalone] Auto-registration completed for course: ${config.course}`);
      } else {
        console.log(`[Standalone] User already registered for course: ${config.course}`);
      }
    } catch (error) {
      console.warn(`[Standalone] Failed to auto-register for course ${config.course}:`, error);
      // Don't block app startup on registration failure
    }
  }

  app.mount('#app');
})();
