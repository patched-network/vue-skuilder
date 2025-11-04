// vue-skuilder/cypress/e2e/user-registration.cy.js
describe('User Registration', () => {
  it('should allow a new user to register', () => {
    // Generate a unique username using timestamp to avoid conflicts
    cy.registerUser().then((username) => {
      // Wait for the registration process to complete
      // You may need to adjust the assertion based on what indicates successful registration in your app
      cy.url().should('include', `/u/${username}/new`);

      // Additional assertions to verify that the user is logged in
      // For example, check if a profile element or welcome message is visible
      cy.contains(`Welcome, ${username}`).should('be.visible');

      // Navigate to the home page and verify that the user's username is displayed
      cy.visit('/');
      cy.reload();
      cy.contains('.v-chip', username);
    });
  });

  it('should prevent registration with an existing username', () => {
    cy.visit('/');
    cy.contains('Sign Up').click({ force: true });

    // Use a username that you know already exists
    const existingUsername = 'Colin'; // Replace with a username that exists in your system
    const password = 'password123';

    // Fill out the registration form with an existing username
    cy.get('input[name="username"]').type(existingUsername);
    cy.get('input[name="password"]').type(password);
    cy.get('input[name="retypedPassword"]').type(password);

    // Submit the form
    cy.contains('button', 'Create Account').click();

    // Assert that an error message is displayed
    cy.contains('The name ' + existingUsername + ' is taken!').should('be.visible');

    // Assert that we're still on the registration page
    cy.url().should('not.include', `/u/${existingUsername}`);
  });

  it('should validate that passwords match', () => {
    cy.visit('/');
    cy.contains('Sign Up').click({ force: true });

    const username = `testuser${Date.now()}`;
    const password = 'password123';
    const differentPassword = 'different123';

    // Fill out the form with non-matching passwords
    cy.get('input[name="username"]').type(username);
    cy.get('input[name="password"]').type(password);
    cy.get('input[name="retypedPassword"]').type(differentPassword);

    // Assert that the Create Account button is disabled due to password mismatch
    cy.contains('button', 'Create Account').should('be.disabled');

    // Assert that an error message about password mismatch is displayed
    cy.contains('Passwords must match').should('be.visible');

    // Assert that we're still on the registration page
    cy.url().should('not.include', `/u/${username}`);
  });

  it('should not render Signup form if logged in', () => {
    cy.registerUser().then(() => {
      cy.visit('/signup');
      cy.url().should('include', '/signup');

      // Check that the signup form is not displayed
      cy.get('input[name="username"]').should('not.exist');
      cy.get('input[name="password"]').should('not.exist');
      cy.get('input[name="retypedPassword"]').should('not.exist');

      // Alternative approach - check for any input field
      cy.get('form input').should('not.exist');

      // Check that some logged-in state indicator is present instead
      cy.contains('Already logged in').should('be.visible');
    });
  });

  it('should not render Login form if logged in', () => {
    cy.registerUser().then((username) => {
      cy.visit('/login');
      cy.url().should('include', '/login');

      // Check that the login form is not displayed
      cy.get('input[name="username"]').should('not.exist');
      cy.get('input[name="password"]').should('not.exist');

      // Check that the logged-in message is displayed
      cy.contains('Already logged in').should('be.visible');

      // Check that the username is displayed
      cy.contains(`You are currently logged in as ${username}`).should('be.visible');

      // Check that the logout button is present
      cy.contains('button', 'Log out').should('be.visible');

      // Test logout functionality - ignore uncaught exceptions for this part
      cy.on('uncaught:exception', () => {
        // returning false here prevents Cypress from failing the test
        return false;
      });
      cy.contains('button', 'Log out').click();

      // After logout, the login form should be present again
      cy.get('input[name="username"]').should('exist');
      cy.get('input[name="password"]').should('exist');
    });
  });
});
