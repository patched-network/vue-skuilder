declare namespace Cypress {
  interface Chainable<Subject> {
    /**
     * Custom command to mount Vue components for testing
     * @example cy.mount(Component, options)
     */
    mount: typeof import('cypress/vue').mount;
  }
}
