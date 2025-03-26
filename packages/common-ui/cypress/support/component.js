// packages/common-ui/cypress/support/component.js
import { mount } from 'cypress/vue';
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';

// Create Vuetify instance
const vuetify = createVuetify();

// Add mount command directly without type checking
Cypress.Commands.add('mount', (component, options = {}) => {
  // Initialize options if not provided
  if (!options.global) {
    options.global = {};
  }
  if (!options.global.plugins) {
    options.global.plugins = [];
  }

  // Add Vuetify to the component
  options.global.plugins.push({
    install(app) {
      app.use(vuetify);
    },
  });

  return mount(component, options);
});
