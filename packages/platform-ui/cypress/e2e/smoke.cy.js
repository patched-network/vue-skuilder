describe('Smoke Test', () => {
  it('should load the application', () => {
    cy.visit('/');

    cy.get('h1') // find 'banner' element on front page
      .contains(/edu.*Quilt/)
      .should('be.visible');
  });
});
