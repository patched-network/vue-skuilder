// standalone-ui/cypress/support/commands.js
// Custom commands for Cypress tests

// Command for logging in a user
Cypress.Commands.add('login', (username, password) => {
  cy.visit('/login');
  cy.get('input[name="username"]').type(username);
  cy.get('input[name="password"]').type(password);
  cy.contains('button', 'Log in').click();
  
  // Optional: Wait for login to complete and redirect
  cy.url().should('not.include', '/login');
});

// Command for registering a new user
Cypress.Commands.add('registerUser', (username = null, password = 'securePassword123') => {
  // Generate a unique username if none provided
  const finalUsername = username || `testuser${Date.now()}`;

  // Visit the signup page
  cy.visit('/signup');

  // Fill out the registration form
  cy.get('input[name="username"]').type(finalUsername);
  cy.get('input[name="password"]').type(password);
  cy.get('input[name="retypedPassword"]').type(password);

  // Submit the form
  cy.contains('button', 'Create Account').click();

  // Wait for registration to complete
  cy.url().should('include', `/u/${finalUsername}/new`);

  // Return the created username so it can be used in tests
  return cy.wrap(finalUsername);
});