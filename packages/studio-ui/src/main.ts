import { createApp } from 'vue';
import { createPinia } from 'pinia';

// Vuetify
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import '@mdi/font/css/materialdesignicons.css';

// Component library styles
import '@vue-skuilder/courseware/style';
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
  console.log('   ✅ Course components imported successfully');

  // Check for custom questions configuration and import if available
  console.log('🎨 Studio Mode: Checking for custom questions configuration');
  let customQuestions = null;
  const customQuestionsStatus: {
    configFetched: boolean;
    configStatus?: number;
    hasCustomQuestions?: boolean;
    importPath?: string;
    importAttempted: boolean;
    importSucceeded: boolean;
    moduleExports?: string[];
    allCustomQuestionsType?: string;
    coursesCount?: number;
    questionClassesCount?: number;
    error?: string;
  } = { configFetched: false, importAttempted: false, importSucceeded: false };
  try {
    console.log('   📁 Fetching custom-questions-config.json');
    const configResponse = await fetch('/custom-questions-config.json');
    customQuestionsStatus.configFetched = true;
    customQuestionsStatus.configStatus = configResponse.status;

    console.log(`   🔍 Config fetch response status: ${configResponse.status}`);
    console.log(`   🔍 Config fetch response URL: ${configResponse.url}`);

    if (configResponse.ok) {
      console.log('   ✅ Custom questions config file found');
      const customConfig = await configResponse.json();
      console.log('   📋 Custom config parsed:', customConfig);
      customQuestionsStatus.hasCustomQuestions = customConfig.hasCustomQuestions;
      customQuestionsStatus.importPath = customConfig.importPath;

      if (customConfig.hasCustomQuestions && customConfig.importPath) {
        console.log(`🎨 Studio Mode: Loading custom questions from ${customConfig.packageName}`);
        console.log(`   📦 Import path: ${customConfig.importPath}`);

        try {
          console.log('   🔄 Attempting dynamic import...');
          customQuestionsStatus.importAttempted = true;
          const customModule = await import(/* @vite-ignore */ customConfig.importPath);
          customQuestionsStatus.importSucceeded = true;
          customQuestionsStatus.moduleExports = Object.keys(customModule);
          customQuestionsStatus.allCustomQuestionsType = typeof customModule.allCustomQuestions;
          console.log('   ✅ Custom module imported successfully');
          console.log('   🔍 Module exports:', Object.keys(customModule));

          customQuestions = customModule.allCustomQuestions?.();
          if (customQuestions) {
            customQuestionsStatus.coursesCount = customQuestions.courses?.length ?? 0;
            customQuestionsStatus.questionClassesCount = customQuestions.questionClasses?.length ?? 0;
            console.log(
              `   ✅ Loaded custom questions: ${customQuestions.questionClasses?.length || 0} types`
            );
            console.log('   📊 Custom questions object:', customQuestions);
          } else {
            customQuestionsStatus.error = 'allCustomQuestions() returned null/undefined';
            console.error('   ❌ FATAL: Custom module did not return questions data!');
            console.error('   🔍 allCustomQuestions result:', customQuestions);
            console.error('   🔍 allCustomQuestions function:', customModule.allCustomQuestions);
          }
        } catch (importError) {
          customQuestionsStatus.error = `Import failed: ${importError instanceof Error ? importError.message : String(importError)}`;
          console.error('   ❌ FATAL: Failed to import custom questions module!');
          console.error('   🔍 Import path attempted:', customConfig.importPath);
          console.error('   🔍 Error:', importError);
          // Note: previously this rethrew, which prevented the rest of studio
          // bootstrap (BlanksCard registration, app mount) from running.
          // Keep silent here so the app still mounts and the DOM surfaces the
          // diagnostic state via the customQuestionsStatus provide() below.
        }
      } else {
        customQuestionsStatus.error =
          'config exists but hasCustomQuestions is false or importPath is missing';
        console.warn('   ⚠️  Config exists but hasCustomQuestions is false or importPath is missing');
        console.warn('   🔍 Config content:', customConfig);
      }
    } else {
      customQuestionsStatus.error = `config fetch returned HTTP ${configResponse.status}`;
      console.warn(`   ⚠️  Custom questions config not found (HTTP ${configResponse.status})`);
      console.warn(`   🔍 Attempted URL: ${configResponse.url}`);
    }
  } catch (configError) {
    customQuestionsStatus.error = `config fetch threw: ${configError instanceof Error ? configError.message : String(configError)}`;
    console.error('   ❌ Error fetching custom questions config:', configError);
    // Don't throw - missing config is valid for non-custom courses
  }

  // Register custom question types in CourseConfig if available
  if (customQuestions) {
    console.log('🎨 Studio Mode: Registering custom question types in CourseConfig');
    try {
      const { getDataLayer } = await import('@vue-skuilder/db');
      const courseDB = getDataLayer().getCourseDB(studioConfig.database.name);
      const courseConfig = await courseDB.getCourseConfig();

      const { registerCustomQuestionTypes } = await import('@vue-skuilder/db');
      const registrationResult = await registerCustomQuestionTypes(
        customQuestions,
        courseConfig,
        courseDB
      );

      if (registrationResult.success) {
        console.log(
          `   ✅ Custom question types registered successfully: ${registrationResult.registeredCount} items`
        );
      } else {
        console.warn(
          `   ⚠️  Custom question type registration failed: ${registrationResult.errorMessage}`
        );
      }
    } catch (registrationError) {
      console.warn(
        `   ⚠️  Failed to register custom question types: ${registrationError instanceof Error ? registrationError.message : String(registrationError)}`
      );
    }
  }

  // Register BlanksCard (markdown fillIn) by default for all studio sessions
  console.log('🎨 Studio Mode: Registering default BlanksCard question type');
  try {
    const { getDataLayer } = await import('@vue-skuilder/db');
    const courseDB = getDataLayer().getCourseDB(studioConfig.database.name);
    const courseConfig = await courseDB.getCourseConfig();

    const { BlanksCard, BlanksCardDataShapes } = await import('@vue-skuilder/courseware');
    const { registerBlanksCard } = await import('@vue-skuilder/db');
    
    const blanksRegistrationResult = await registerBlanksCard(
      BlanksCard,
      BlanksCardDataShapes,
      courseConfig,
      courseDB
    );

    if (blanksRegistrationResult.success) {
      console.log('   ✅ BlanksCard question type registered successfully');
    } else {
      console.warn(`   ⚠️  BlanksCard registration failed: ${blanksRegistrationResult.errorMessage}`);
    }
  } catch (blanksError) {
    console.warn(
      `   ⚠️  Failed to register BlanksCard: ${blanksError instanceof Error ? blanksError.message : String(blanksError)}`
    );
  }

  // Register custom courses with the allCourseWare singleton
  console.log('🎨 Studio Mode: Registering custom courses');
  const { allCourseWare } = await import('@vue-skuilder/courseware');
  console.log(`   🔍 allCourseWare instance:`, allCourseWare);
  console.log(`   🔍 Current courses BEFORE registration:`, allCourseWare.courses.map(c => c.name));

  if (customQuestions?.courses) {
    console.log(`   📦 Registering ${customQuestions.courses.length} custom course(s)`);
    console.log(`   📦 Custom courses to register:`, customQuestions.courses.map(c => c.name));
    customQuestions.courses.forEach((course) => {
      // Check if already registered to avoid duplicates
      if (!allCourseWare.courses.find((c) => c.name === course.name)) {
        allCourseWare.courses.push(course);
        console.log(`   ✅ Registered course: ${course.name}`);
      } else {
        console.log(`   ℹ️  Course ${course.name} already registered`);
      }
    });
    console.log(`   🔍 Current courses AFTER registration:`, allCourseWare.courses.map(c => c.name));
  }

  console.log('🎨 Studio Mode: Collecting view components');
  const viewComponents = allCourseWare.allViewsRaw();
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

  // Provide inline markdown components if available
  console.log('🎨 Studio Mode: Checking for inline markdown components');
  if (customQuestions?.inlineComponents) {
    console.log(`   ✅ Found ${Object.keys(customQuestions.inlineComponents).length} inline components`);
    console.log(`   📋 Component names: ${Object.keys(customQuestions.inlineComponents).join(', ')}`);
    app.provide('markdownComponents', customQuestions.inlineComponents);
  } else {
    console.log('   ℹ️  No inline markdown components available');
    app.provide('markdownComponents', {});
  }

  // Surface custom-questions load status to views (CreateCardView reads this
  // to render a diagnostic error panel when shape resolution fails).
  app.provide('customQuestionsStatus', customQuestionsStatus);

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
