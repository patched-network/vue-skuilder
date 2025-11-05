// Test for CLI scaffolded application
describe('CLI Scaffolded App - Study View', () => {
  it('should navigate to /study and render a card', () => {
    // Visit the study page
    cy.visit('/study');

    // Wait for the application to load and render
    // Check for the presence of a card view
    // The cardView class is present on all rendered cards
    cy.get('.cardView', { timeout: 15000 })
      .should('exist')
      .and('be.visible');

    // Additional validation: check that the card has a viewable data attribute
    // This indicates it's a properly rendered card component
    cy.get('[data-viewable]', { timeout: 15000 })
      .should('exist')
      .and('be.visible');

    // Verify that the card container (v-card) is present
    cy.get('.v-card', { timeout: 15000 })
      .should('exist')
      .and('be.visible');
  });

  it('should load the home page successfully', () => {
    cy.visit('/');

    // Verify basic page load
    cy.get('body').should('be.visible');
  });
});
