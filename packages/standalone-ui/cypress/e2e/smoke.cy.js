// Basic smoke test for standalone-ui
describe('Smoke Test', () => {
  it('should load the application', () => {
    cy.visit('/');
    
    // Verify that the application loaded
    // Update selector as needed based on your actual UI
    cy.get('body').should('be.visible');
  });
});