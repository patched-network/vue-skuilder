import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173', // Default Vite dev server port
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
  // Increase the default timeout for slower operations
  defaultCommandTimeout: 10000,
  // Viewport configuration
  viewportWidth: 1280,
  viewportHeight: 800,
});
