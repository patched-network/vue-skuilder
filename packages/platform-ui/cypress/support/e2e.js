// vue-skuilder/cypress/support/e2e.js
// This is the main support file for Cypress E2E tests
// You can add global configurations, commands, and hooks here

// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// You can read more here: https://on.cypress.io/configuration

// cypress/support/e2e.js
Cypress.on('uncaught:exception', (err) => {
  // Log the error for debugging
  console.log('Uncaught exception:', err.message);

  // If the error is from PouchDB, ignore it
  if (err.message.includes('not_found') || err.message.includes('missing')) {
    return false; // Prevents Cypress from failing the test
  }
  return true; // Otherwise, fail the test
});
