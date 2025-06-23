describe('Content Authoring', () => {
  it('should allow adding new course content with proper authentication', () => {
    // Generate a random tag to avoid conflicts between test runs
    const testTag = `test-${Math.random().toString(36).substring(2, 8)}`;

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

      // Add a test tag to validate tag creation and authorship
      cy.log(`Adding test tag: ${testTag}`);
      cy.get('[data-cy="tags-input"]').type(`${testTag} `);
      cy.wait(1_000);

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

      // Verify the test tag appears on the course information page
      cy.log(`Verifying tag exists: ${testTag}`);
      cy.contains(testTag).should('be.visible');

      // Navigate to the tag page and verify it has exactly 1 card (the one we just created)
      cy.log(`Navigating to tag page: ${testTag}`);
      cy.contains(testTag).click();
      cy.wait(3_000); // Wait for tag page to load

      // Verify the tag page shows exactly 1 card
      cy.get('[data-cy="paginating-toolbar-subtitle"]')
        .should('contain.text', '(1)')
        .then(() => {
          cy.log(`Tag ${testTag} successfully created with 1 card`);
        });
    });
  });
});
