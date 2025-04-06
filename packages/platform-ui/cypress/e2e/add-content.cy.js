// platform-ui/cypress/e2e/add-content.cy.js
describe('Content Authoring', () => {
  let username;
  const courseName = `Content Test Course ${Math.floor(Math.random() * 10000)}`;
  const courseDescription = 'This course is for testing content creation functionality';

  Cypress.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    return false;
  });

  it('should allow a user to create and navigate to a course for adding content', () => {
    // Register a new user
    cy.registerUser().then((user) => {
      username = user;
      // Wait for registration to complete and redirect
      cy.url().should('include', `/u/${username}/new`);

      // Navigate to the quilts (courses) page
      cy.visit('/quilts');

      // Create a new course
      cy.get('[data-cy="create-course-fab"]').click();
      cy.get('[data-cy="course-name-input"]').type(courseName);
      cy.get('[data-cy="course-description-input"]').type(courseDescription);
      cy.get('[data-cy="private-radio"]').click(); // Create as private course initially
      cy.get('[data-cy="save-course-button"]').click();

      // Wait for creation to complete and dialog to close
      cy.wait(1000);

      cy.visit(`/quilts/${courseName.replaceAll(' ', '_')}`);

      // Register via `register` button, then wait
      cy.get('[data-cy="register-btn"]').click();
      cy.wait(1000);

      // click `add content` button
      cy.get('[data-cy="add-content-btn"]').click();
      cy.wait(1000);

      cy.get('[data-cy="markdown-input"] textarea')
        .should('be.visible')
        .type('This {{ is || is not }} a question.', {
          parseSpecialCharSequences: false,
        });
      cy.get('[data-cy="add-card-btn"').click();
    });
  });
});
