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

  it('should show custom DataShapes in CreateCardView', () => {
    cy.visit('http://localhost:7174/create');

    // Wait for page to load
    cy.get('body', { timeout: 15000 }).should('be.visible');

    // Verify custom question types appear as options
    // (Exact selectors will depend on studio-ui CreateCardView implementation)
    cy.contains('SimpleTextQuestion', { timeout: 15000 }).should('exist');
    cy.contains('MultipleChoiceQuestion').should('exist');
    cy.contains('NumberRangeQuestion').should('exist');
  });

  it('should create a card with SimpleTextQuestion DataShape', () => {
    cy.visit('http://localhost:7174/create');

    // Wait for page load
    cy.get('body', { timeout: 15000 }).should('be.visible');

    // Select SimpleTextQuestion DataShape
    // (Exact interaction will depend on studio-ui form implementation)
    cy.contains('SimpleTextQuestion').click();

    // Fill in required fields
    // Field names/selectors depend on studio-ui form structure
    // This is a placeholder - adjust based on actual UI
    cy.get('input[name="questionText"], input[placeholder*="question"]')
      .type('What is 2+2?');
    cy.get('input[name="correctAnswer"], input[placeholder*="answer"]')
      .type('4');

    // Submit the card
    cy.contains('button', /create|save|submit/i).click();

    // Verify success (redirect, message, etc.)
    // Adjust based on studio-ui behavior
    cy.url({ timeout: 10000 }).should('not.include', '/create');
  });

  it('should render created card in studio browse view', () => {
    cy.visit('http://localhost:7174/browse');

    // Wait for cards to load
    cy.get('.cardView, [data-viewable]', { timeout: 15000 })
      .should('exist')
      .and('be.visible');

    // Verify our created card appears
    // Check for SimpleTextQuestionView component
    cy.get('[data-viewable*="SimpleTextQuestionView"]', { timeout: 15000 })
      .should('exist');

    // Verify card content
    cy.contains('What is 2+2?').should('exist');
  });

  it('should flush changes to static files', () => {
    // Navigate to wherever the flush button is located
    // (Could be in settings, admin panel, or main nav)
    cy.visit('http://localhost:7174');

    // Find and click "Flush to Static" button
    // Adjust selector based on actual studio-ui implementation
    cy.contains('button', /flush.*static|save.*static|export/i, { timeout: 10000 })
      .click();

    // Wait for flush operation to complete
    // Look for success message or confirmation
    cy.contains(/flushed|saved|exported|success/i, { timeout: 30000 })
      .should('exist');
  });
});
