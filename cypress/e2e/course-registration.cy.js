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

    // Get the initial count of registered courses (handling the case when there are none)
    cy.get('body').then(($body) => {
      const initialCount = $body.find('[data-cy="registered-course"]').length;

      // Now click the register button on the first available course
      cy.get('[data-cy="available-course-card"]')
        .first()
        .find('[data-cy="register-course-button"]')
        .click();

      // Wait a moment for registration to process
      cy.wait(1000);

      // Verify the count of registered courses has increased
      if (initialCount === 0) {
        // If there were no courses initially, we should have exactly one now
        cy.get('[data-cy="registered-course"]').should('have.length', 1);
      } else {
        // Otherwise the count should have increased by one
        cy.get('[data-cy="registered-course"]').should('have.length', initialCount + 1);
      }
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

  it('should allow a user to drop a registered course', () => {
    // First register for a course
    cy.registerForCourse();

    // Verify registration completed successfully
    cy.get('[data-cy="registered-course"]').should('have.length.at.least', 1);

    // Get the name of the registered course for later verification
    cy.get('[data-cy="registered-course-title"]')
      .first()
      .invoke('text')
      .then((courseName) => {
        // Click the drop button for this course
        cy.get('[data-cy="drop-course-button"]').first().click();

        // Wait for the drop operation to complete
        cy.wait(1000);

        // Verify the course is no longer in registered courses
        cy.get('[data-cy="registered-course-title"]').should('not.exist');

        // Check that the course appears again in available courses
        cy.contains('h2', 'Available Quilts')
          .parent()
          .find('[data-cy="course-title"]')
          .should('contain', courseName);
      });
  });
});
