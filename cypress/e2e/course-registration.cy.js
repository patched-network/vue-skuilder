// vue-skuilder/cypress/e2e/course-registration.cy.js
describe('Course Registration', () => {
  let username;

  beforeEach(() => {
    // Register a new user before each test
    cy.registerUser().then((user) => {
      username = user;
      // Wait for registration to complete and redirect
      cy.url().should('include', `/u/${username}/new`);
    });
  });

  it('should display available courses on the quilts page', () => {
    // Navigate to the quilts (courses) page
    cy.visit('/quilts');

    // Check that the available courses section is visible
    cy.contains('h2', 'Available Quilts').should('be.visible');

    // Verify that course cards are displayed
    cy.get('[data-cy="available-course-card"]').should('have.length.at.least', 1);
  });

  it('should allow a user to register for a course', () => {
    // Navigate to the quilts page
    cy.visit('/quilts');

    // Get the first available course and store its name
    cy.get('[data-cy="available-course-card"]')
      .first()
      .find('[data-cy="course-title"]')
      .invoke('text')
      .then((text) => {
        let courseName = text.trim();

        // Now click the register button
        cy.get('[data-cy="available-course-card"]')
          .first()
          .find('[data-cy="register-course-button"]')
          .click();

        // Wait a moment for registration to process
        cy.wait(1000);

        // Verify the course appears in the user's registered courses
        cy.get('[data-cy="registered-course"]').should('contain', courseName);
      });
  });

  it('should allow registration using the custom command', () => {
    // Register for the first available course
    cy.registerForCourse();

    // Verify registration by checking the registered courses panel
    cy.get('[data-cy="registered-quilts-panel"]').click();
    cy.get('[data-cy="registered-course"]').should('have.length.at.least', 1);
  });

  it('should show registered courses on the study page', () => {
    // Register for a course first
    cy.registerForCourse();

    // Navigate to the study page
    cy.visit('/study');

    // Check that the registered course appears in the study options
    cy.get('[data-cy="select-quilts-header"]').should('be.visible');
    cy.get('[data-cy="course-checkbox"]').should('have.length.at.least', 1);

    // Check that the start button is available
    cy.get('[data-cy="start-studying-button"]').should('be.visible');
  });
});
