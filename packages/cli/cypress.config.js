import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173', // Default Vite dev server port
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    setupNodeEvents(on) {
      // Pipe browser console output (collected by support/e2e.js) to the
      // Cypress runner's terminal so it appears in `gh run view --log`.
      on('task', {
        log(messages) {
          for (const m of messages) {
            // eslint-disable-next-line no-console
            console.log(`[browser ${m.level}] ${m.text}`);
          }
          return null;
        },
      });
    },
  },
  // Increase the default timeout for slower operations
  defaultCommandTimeout: 10000,
  // Viewport configuration
  viewportWidth: 1280,
  viewportHeight: 800,
});
