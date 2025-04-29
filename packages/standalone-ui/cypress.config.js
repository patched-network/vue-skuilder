const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:6173', // package/standalone-ui vite dev server port
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
  //  increase the default timeout for slower operations
  defaultCommandTimeout: 10000,
  // Viewport configuration
  viewportWidth: 1280,
  viewportHeight: 800,
});