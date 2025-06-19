describe('Content Authoring', () => {
  it('should allow adding new course content with proper authentication', () => {
    // Register user and verify they can login
    cy.registerUser().then((user) => {
      const username = user;
      cy.url().should('include', `/u/${username}/new`);

      cy.log(`User ${username} Created`);
      cy.wait(2_000);

      // Navigate to anatomy course page
      cy.visit('/q/e92135c6c3ba6fba79367e7f26001ef3');

      // Wait for the slow course loading to complete
      cy.wait(60_000);
      cy.log('Waited 60s for course data to load');

      // Wait for CourseCardBrowser to load and record initial card count from PaginatingToolbar subtitle (format: "(count)")
      let initialCardCount = 0;
      cy.get('[data-cy="paginating-toolbar-subtitle"]').should('contain.text', '(')
        .invoke('text').then((text) => {
          const match = text.match(/\((\d+)\)/);
          if (match) {
            initialCardCount = parseInt(match[1]);
            cy.log(`Initial card count: ${initialCardCount}`);
          }
        });

      // Now check for the register button with current DOM state
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="register-btn"]').length > 0) {
          // User is not registered, click register button
          cy.get('[data-cy="register-btn"]').click();
          cy.wait(2_000);
        } else {
          // Catastrophic failure - abort test
          cy.log('Registration failed. Failing test.');
          throw new Error('User registration failed, cannot proceed with content authoring test');
        }
      });

      // After registration, click the "Add content" button
      cy.get('[data-cy="add-content-btn"]').click();
      cy.wait(2_000);

      // Type sample content in the textarea
      cy.get('textarea[name="Input"]').type('What is the capital of France? ___');
      
      // Find and click the Add Card button
      cy.contains('button', 'Add card').click();
      cy.wait(2_000);

      // Return to CourseInformation page to verify card count increment
      cy.visit('/q/e92135c6c3ba6fba79367e7f26001ef3');
      cy.wait(5_000); // Wait for page reload and data refresh

      // Assert that the card count has incremented by 1
      cy.get('[data-cy="paginating-toolbar-subtitle"]').should('contain.text', '(')
        .invoke('text').then((text) => {
          const match = text.match(/\((\d+)\)/);
          if (match) {
            const newCardCount = parseInt(match[1]);
            cy.log(`New card count: ${newCardCount}`);
            cy.wrap(newCardCount).should('eq', initialCardCount + 1);
          }
        });
    });
  });
});
