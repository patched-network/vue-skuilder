// packages/common-ui/cypress/support/component.js
import { mount } from 'cypress/vue';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createPinia } from 'pinia';

// Import Vuetify styles
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import './component-styles.css';

// Create a more complete Vuetify instance
const vuetify = createVuetify({
  components,
  directives,
});

// Add mount command
Cypress.Commands.add('mount', (component, options = {}) => {
  // Initialize options if not provided
  if (!options.global) {
    options.global = {};
  }
  if (!options.global.plugins) {
    options.global.plugins = [];
  }

  // Create fresh Pinia instance for each test
  const pinia = createPinia();

  // Capture any provide directives from the test
  const testProvide = options.global.provide || {};

  // Add Vuetify and Pinia to the component
  options.global.plugins.push({
    install(app) {
      app.use(vuetify);
      app.use(pinia);

      // Apply any provide directives from the test
      Object.keys(testProvide).forEach((key) => {
        app.provide(key, testProvide[key]);
      });
    },
  });

  // Set up any global components needed

  // Set up any specific Vuetify-related configurations
  const el = document.createElement('div');
  el.id = 'app';
  document.body.appendChild(el);

  // Add Vuetify CSS classes to the body
  document.body.setAttribute('data-cy-vuetify', '');
  document.body.classList.add('v-application');
  document.body.classList.add('v-theme--light');

  return mount(component, {
    ...options,
    attachTo: '#app',
  });
});
