describe('StudySession', () => {
  let username;

  beforeEach(() => {
    // Register a new user before each test
    cy.registerUser().then((user) => {
      username = user;
      // Wait for registration to complete and redirect
      cy.url().should('include', `/u/${username}/new`);
    });
  });

  it('renders a card', () => {
    cy.registerForCourse('Anatomy');

    cy.visit(`/study`);
  });
});
