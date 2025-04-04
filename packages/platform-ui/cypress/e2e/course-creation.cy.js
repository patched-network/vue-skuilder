describe('Course Creation', () => {
  let firstUsername;
  let secondUsername;
  const privateCourseName = `Private Test Course ${Math.floor(Math.random() * 10000)}`;
  const publicCourseName = `Public Test Course ${Math.floor(Math.random() * 10000)}`;
  const courseDescription = 'This is a test course created by automated testing';

  before(() => {
    // We'll use this hook to clean up any test data if needed
  });

  it('should allow a user to create private and public courses', () => {
    // Register first user
    cy.registerUser().then((user) => {
      firstUsername = user;
      // Wait for registration to complete and redirect
      cy.url().should('include', `/u/${firstUsername}/new`);

      // Navigate to the quilts (courses) page
      cy.visit('/quilts');

      // Create a private course
      cy.get('[data-cy="create-course-fab"]').click();
      cy.get('[data-cy="course-name-input"]').type(privateCourseName);
      cy.get('[data-cy="course-description-input"]').type(courseDescription);
      cy.get('[data-cy="private-radio"]').click();
      cy.get('[data-cy="save-course-button"]').click();

      // Wait for creation to complete and dialog to close
      cy.wait(1000);

      // click the show-more button
      cy.get('[data-cy="courses-show-more-button"]').click();

      // Verify the private course was created and appears in available courses
      cy.contains('h2', 'Available Quilts')
        .parent()
        .find('[data-cy="course-title"]')
        .should('contain', privateCourseName);

      // Create a public course
      cy.get('[data-cy="create-course-fab"]').click();
      cy.get('[data-cy="course-name-input"]').type(publicCourseName);
      cy.get('[data-cy="course-description-input"]').type(courseDescription);
      cy.get('[data-cy="public-radio"]').click();
      cy.get('[data-cy="save-course-button"]').click();

      // Wait for creation to complete and dialog to close
      cy.wait(1000);

      // Verify the public course was created and appears in available courses
      cy.contains('h2', 'Available Quilts')
        .parent()
        .find('[data-cy="course-title"]')
        .should('contain', publicCourseName);
    });
  });

  it('should show only public courses to other users', () => {
    // Register second user
    cy.registerUser().then((user) => {
      secondUsername = user;
      // Wait for registration to complete and redirect
      cy.url().should('include', `/u/${secondUsername}/new`);

      // Navigate to the quilts (courses) page
      cy.visit('/quilts');

      // click the show-more button
      cy.get('[data-cy="courses-show-more-button"]').click();

      // Look for public course in available courses section
      cy.contains('h2', 'Available Quilts')
        .parent()
        .find('[data-cy="course-title"]')
        .should('contain', publicCourseName);

      // Verify private course is not visible to this user
      cy.contains('h2', 'Available Quilts')
        .parent()
        .find('[data-cy="course-title"]')
        .should('not.contain', privateCourseName);
    });
  });
});
