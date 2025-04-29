// standalone-ui/cypress/e2e/auth.cy.js
// Tests for authentication flow including login, registration, and logout

describe('Authentication', () => {
  // Helper function to create a random username
  const generateUsername = () => `testuser${Date.now()}`;

  // Setup for each test
  beforeEach(() => {
    // Any test setup can go here
  });

  describe('Login', () => {
    it('should display login form', () => {
      cy.visit('/login');
      
      // Check that the login form exists
      cy.get('input[name="username"]').should('be.visible');
      cy.get('input[name="password"]').should('be.visible');
      cy.contains('button', 'Log in').should('be.visible');
    });

    it('should show error message with invalid credentials', () => {
      const nonExistentUser = `nonexistent${Date.now()}`;
      
      cy.visit('/login');
      cy.get('input[name="username"]').type(nonExistentUser);
      cy.get('input[name="password"]').type('wrongpassword');
      cy.contains('button', 'Log in').click();
      
      // Check for error message
      cy.contains('Invalid username or password').should('be.visible');
      
      // Should still be on login page
      cy.url().should('include', '/login');
    });

    it('should successfully log in with valid credentials', () => {
      // Create a user first
      cy.registerUser().then((username) => {
        // Log out first to ensure we're starting from a clean state
        cy.contains('Log out').click();
        
        // Wait for logout to complete
        cy.url().should('include', '/login');
        
        // Now log in with the created user
        cy.login(username, 'securePassword123');
        
        // Check that we're redirected to the study page
        cy.url().should('include', '/study');
        
        // Check that user is logged in
        cy.contains(username).should('be.visible');
      });
    });
    
    it('should redirect to intended page after login', () => {
      // Visit a protected route
      cy.visit('/study');
      
      // Should be redirected to login
      cy.url().should('include', '/login');
      
      // Log in
      cy.registerUser().then((username) => {
        // Should be redirected back to the originally requested page
        cy.url().should('include', '/study');
      });
    });
  });

  describe('Registration', () => {
    it('should allow new user registration', () => {
      const username = generateUsername();
      const password = 'securePassword123';
      
      cy.visit('/signup');
      
      // Fill out registration form
      cy.get('input[name="username"]').type(username);
      cy.get('input[name="password"]').type(password);
      cy.get('input[name="retypedPassword"]').type(password);
      cy.contains('button', 'Create Account').click();
      
      // Check that registration was successful by checking URL or welcome message
      cy.url().should('include', `/u/${username}/new`);
      cy.contains(`Welcome, ${username}`).should('be.visible');
    });
    
    it('should validate password match during registration', () => {
      const username = generateUsername();
      
      cy.visit('/signup');
      
      // Fill out form with mismatched passwords
      cy.get('input[name="username"]').type(username);
      cy.get('input[name="password"]').type('password123');
      cy.get('input[name="retypedPassword"]').type('differentPassword');
      cy.contains('button', 'Create Account').click();
      
      // Should show error message
      cy.contains('Passwords do not match').should('be.visible');
      
      // Should still be on registration page
      cy.url().should('include', '/signup');
    });
    
    it('should prevent registration with existing username', () => {
      // First create a user
      cy.registerUser().then((existingUsername) => {
        // Log out
        cy.contains('Log out').click();
        
        // Try to register with the same username
        cy.visit('/signup');
        cy.get('input[name="username"]').type(existingUsername);
        cy.get('input[name="password"]').type('password123');
        cy.get('input[name="retypedPassword"]').type('password123');
        cy.contains('button', 'Create Account').click();
        
        // Should show error message
        cy.contains(`The name ${existingUsername} is taken!`).should('be.visible');
      });
    });
  });

  describe('Logout', () => {
    it('should successfully logout', () => {
      // First login
      cy.registerUser().then(() => {
        // Perform logout
        cy.contains('Log out').click();
        
        // Verify logout was successful
        cy.url().should('include', '/login');
        
        // Verify login form is visible again
        cy.get('input[name="username"]').should('be.visible');
        cy.get('input[name="password"]').should('be.visible');
      });
    });
    
    it('should clear user session after logout', () => {
      cy.registerUser().then(() => {
        // Logout first
        cy.contains('Log out').click();
        
        // Try to access protected route
        cy.visit('/study');
        
        // Should be redirected to login page
        cy.url().should('include', '/login');
      });
    });
  });

  describe('Authentication Protection', () => {
    it('should redirect unauthenticated users to login page', () => {
      // Visit protected routes without authentication
      cy.visit('/study');
      cy.url().should('include', '/login');
      
      cy.visit('/progress');
      cy.url().should('include', '/login');
    });
    
    it('should not show login/signup forms when logged in', () => {
      cy.registerUser().then(() => {
        // Visit login page while logged in
        cy.visit('/login');
        
        // Should not see login form
        cy.get('input[name="username"]').should('not.exist');
        cy.contains('Already logged in').should('be.visible');
        
        // Visit signup page while logged in
        cy.visit('/signup');
        
        // Should not see signup form
        cy.get('input[name="retypedPassword"]').should('not.exist');
        cy.contains('Already logged in').should('be.visible');
      });
    });
  });
});