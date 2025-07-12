import { createApp } from 'vue';
import { createPinia } from 'pinia';

// Vuetify
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import '@mdi/font/css/materialdesignicons.css';

// Component library styles
import '@vue-skuilder/courses/style';
import '@vue-skuilder/common-ui/style';
import '@vue-skuilder/edit-ui/style';

// Data layer initialization
import { initializeDataLayer } from '@vue-skuilder/db';

import App from './App.vue';
import router from './router';
import { getStudioConfig, getConfigErrorMessage } from './config/development';

// Initialize Vuetify with all components and directives
const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
  },
});

(async () => {
  // Get studio configuration (CLI-injected or environment variables)
  const studioConfig = getStudioConfig();

  if (!studioConfig) {
    throw new Error(getConfigErrorMessage());
  }

  // Parse the CLI-provided CouchDB URL (format: http://localhost:5985)
  const couchUrl = new URL(studioConfig.couchdb.url);
  const serverUrl = `${couchUrl.hostname}:${couchUrl.port}/`;

  console.log('🎨 Studio Mode: Initializing data layer with CLI-provided CouchDB connection');
  console.log(`   Server: ${couchUrl.protocol}//${serverUrl}`);
  console.log(`   Username: ${studioConfig.couchdb.username}`);

  await initializeDataLayer({
    type: 'couch',
    options: {
      COUCHDB_SERVER_PROTOCOL: couchUrl.protocol.replace(':', ''),
      COUCHDB_SERVER_URL: serverUrl,
      COUCHDB_USERNAME: studioConfig.couchdb.username,
      COUCHDB_PASSWORD: studioConfig.couchdb.password,
    },
  });

  const pinia = createPinia();
  const app = createApp(App);

  // Register all course view components globally (like platform-ui)
  console.log('🎨 Studio Mode: Importing course view components');
  const { allCourses: Courses } = await import('@vue-skuilder/courses');
  console.log('   ✅ Course components imported successfully');

  // Check for custom questions configuration and import if available
  console.log('🎨 Studio Mode: Checking for custom questions configuration');
  let customQuestions = null;
  try {
    console.log('   📁 Fetching custom-questions-config.json');
    const configResponse = await fetch('/custom-questions-config.json');
    if (configResponse.ok) {
      console.log('   ✅ Custom questions config file found');
      const customConfig = await configResponse.json();
      console.log('   📋 Custom config parsed:', customConfig);
      if (customConfig.hasCustomQuestions && customConfig.importPath) {
        console.log(`🎨 Studio Mode: Loading custom questions from ${customConfig.packageName}`);
        console.log(`   📦 Import path: ${customConfig.importPath}`);
        try {
          const customModule = await import(customConfig.importPath);
          console.log('   ✅ Custom module imported successfully');
          customQuestions = customModule.allCustomQuestions?.();
          if (customQuestions) {
            console.log(
              `   ✅ Loaded custom questions: ${customQuestions.questionClasses?.length || 0} types`
            );
            console.log('   📊 Custom questions object:', customQuestions);
          } else {
            console.log('   ⚠️  Custom module did not return questions data');
          }
        } catch (importError) {
          console.warn(
            `   ⚠️  Failed to import custom questions: ${importError instanceof Error ? importError.message : String(importError)}`
          );
        }
      } else {
        console.log(
          '   ℹ️  Custom config exists but hasCustomQuestions is false or importPath is missing'
        );
      }
    } else {
      console.log('   ℹ️  Custom questions config file not found (this is normal)');
    }
  } catch (configError) {
    // No custom questions config - this is normal for default studio mode
    console.log('   ℹ️  No custom questions config available (default studio mode)');
  }


  console.log('🎨 Studio Mode: Collecting view components');
  const viewComponents = Courses.allViewsRaw();
  console.log(`   ✅ Collected ${Object.keys(viewComponents).length} base view components`);

  // Add custom question view components if available
  if (customQuestions?.views) {
    console.log(`   📦 Adding ${customQuestions.views.length} custom question view components`);
    customQuestions.views.forEach((view: any) => {
      if (view.name && view.component) {
        console.log(`   ➕ Registering custom view component: ${view.name}`);
        viewComponents[view.name] = view.component;
      } else {
        console.warn(`   ⚠️  Skipping invalid custom view (missing name or component):`, view);
      }
    });
    console.log(
      `   ✅ Total view components after custom additions: ${Object.keys(viewComponents).length}`
    );
  } else {
    console.log('   ℹ️  No custom question views to add');
  }

  Object.entries(viewComponents).forEach(([name, component]) => {
    app.component(name, component);
  });

  app.use(pinia);
  app.use(vuetify);
  app.use(router);

  // Dynamically import piniaPlugin (like platform-ui)
  const { piniaPlugin, useAuthStore } = await import('@vue-skuilder/common-ui');
  app.use(piniaPlugin, { pinia });

  // Initialize auth store like standalone-ui does
  await useAuthStore().init();

  app.mount('#app');
})();
