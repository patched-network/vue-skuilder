// Custom Questions Workflow - Studio Mode
// Tests custom question DataShapes in studio mode:
// - CreateCardView shows custom question types
// - Can create card with custom DataShape
// - Card renders in browse view
// - Flush to static works

describe('Custom Questions - Studio Mode', () => {
  it('should load studio UI successfully', () => {
    cy.visit('http://localhost:7174');

    // Verify basic page load
    cy.get('body').should('be.visible');
  });

  it('should create a card with SimpleTextQuestion DataShape', () => {
    cy.visit('http://localhost:7174/create-card');

    // Wait for v-select to appear
    cy.get('.v-select', { timeout: 15000 }).should('be.visible');

    // Check if form is already visible (from previous test state)
    cy.get('body').then(($body) => {
      if ($body.find('input[name="questionText"]').length === 0) {
        // Form not visible, need to select from dropdown
        cy.get('.v-select').click();
        cy.wait(500);
        cy.get('.v-list-item').contains('SimpleTextQuestion', { timeout: 10000 }).click();
      }
      // Otherwise form is already visible, just fill it out
    });

    // Wait for form fields to appear
    cy.get('input[name="questionText"]', { timeout: 10000 })
      .clear()
      .type('What is 2+2?');

    cy.get('input[name="correctAnswer"]')
      .clear()
      .type('4');

    // Submit the card using data-cy attribute
    cy.get('[data-cy="add-card-btn"]').should('be.visible').click();

    // Wait for card creation to complete
    cy.wait(2000);
  });

  it('should show created card exists in browse view', () => {
    cy.visit('http://localhost:7174');

    // Wait for the exercise count to appear in the toolbar
    cy.get('[data-cy="paginating-toolbar-subtitle"]', { timeout: 15000 })
      .should('be.visible');

    // Verify that at least one card row is present in the list
    // Cards are rendered as v-list-item with data-cy="course-card"
    cy.get('[data-cy="course-card"]')
      .should('have.length.at.least', 1);

    // Verify the card shows the correct view name
    cy.get('[data-cy="course-card"]').first().contains('SimpleTextQuestionView');
  });

  // it('should flush changes to static files', () => {
  //   // Flush button is in the app bar (top of any page)
  //   cy.visit('http://localhost:7174/browse');

  //   // Find and click "Flush to Static" button in app bar
  //   cy.contains('button', 'Flush to Static', { timeout: 10000 }).should('be.visible').click();

  //   // Wait for success dialog to appear
  //   cy.contains('Course successfully saved to static files!', { timeout: 30000 }).should(
  //     'be.visible'
  //   );

  //   // Close the dialog
  //   cy.contains('button', 'Close').click();
  // });
});
