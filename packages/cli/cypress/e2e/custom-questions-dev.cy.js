// Custom Questions Workflow - Dev Mode
// Tests that card created in studio mode and flushed to static
// renders correctly in standalone dev mode

describe('Custom Questions - Dev Mode', () => {
  it('should load dev mode successfully', () => {
    cy.visit('http://localhost:6173');

    // Verify basic page load
    cy.get('body').should('be.visible');
  });

  it('should render flushed card in study view', () => {
    cy.visit('http://localhost:6173/study');

    // Wait for study view to load
    cy.get('body', { timeout: 15000 }).should('be.visible');

    // Verify card with SimpleTextQuestionView renders
    cy.get('[data-viewable*="SimpleTextQuestionView"]', { timeout: 15000 })
      .should('exist')
      .and('be.visible');

    // Verify the card content that was created in studio
    cy.contains('What is 2+2?').should('exist');

    // Verify the input element is present (characteristic of SimpleTextQuestionView)
    cy.get('input[type="text"], input[placeholder*="answer"]')
      .should('be.visible');
  });

  it('should allow interaction with the custom question', () => {
    cy.visit('http://localhost:6173/study');

    // Wait for card to render
    cy.get('[data-viewable*="SimpleTextQuestionView"]', { timeout: 15000 })
      .should('exist');

    // Type an answer
    cy.get('input[type="text"], input[placeholder*="answer"]')
      .type('4');

    // Submit (look for submit button)
    cy.contains('button', /submit/i).should('be.visible');
  });
});
