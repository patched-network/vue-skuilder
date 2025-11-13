/**
 * Smoke test for docs site embedded course functionality
 *
 * Ensures that:
 * - The embedded course loads without "not found" errors
 * - The data layer initializes correctly
 * - Study sessions can be started
 * - Cards load successfully
 */

describe('Docs Site - Embedded Course', () => {
  beforeEach(() => {
    // Visit the embedded course test page
    cy.visit('/vue-skuilder/dbg/embedded-course-test.html');
  });

  it('should load the embedded course without "not found" errors', () => {
    // Capture console errors
    const consoleErrors: string[] = [];

    cy.window().then((win) => {
      cy.stub(win.console, 'error').callsFake((...args) => {
        const message = args.join(' ');
        consoleErrors.push(message);
      });
    });

    // Wait for the data layer to initialize
    cy.contains('Interactive study session', { timeout: 10000 }).should('be.visible');

    // Check for "not found" errors in console
    cy.window().then(() => {
      const notFoundErrors = consoleErrors.filter(msg =>
        msg.toLowerCase().includes('not found')
      );

      if (notFoundErrors.length > 0) {
        throw new Error(`Found "not found" errors in console:\n${notFoundErrors.join('\n')}`);
      }
    });
  });

  it('should start a study session and load cards without errors', () => {
    // Capture console errors
    const consoleErrors: string[] = [];

    cy.window().then((win) => {
      cy.stub(win.console, 'error').callsFake((...args) => {
        const message = args.join(' ');
        consoleErrors.push(message);
      });
    });

    // Wait for initialization
    cy.contains('Interactive study session', { timeout: 10000 }).should('be.visible');

    // Wait for the "Start Session" button to appear and click it
    cy.contains('button', 'Start Session', { timeout: 10000 })
      .should('be.visible')
      .click();

    // Wait for the init state to disappear (button should be gone)
    cy.contains('button', 'Start Session').should('not.exist');

    // Verify we're not in loading state
    cy.contains('Loading course').should('not.exist');

    // Give it a moment for card hydration
    cy.wait(2000);

    // Check for "not found" errors in console after session start
    cy.window().then(() => {
      const notFoundErrors = consoleErrors.filter(msg =>
        msg.toLowerCase().includes('not found')
      );

      if (notFoundErrors.length > 0) {
        throw new Error(`Found "not found" errors in console after session start:\n${notFoundErrors.join('\n')}`);
      }
    });

    // Verify no error state is shown
    cy.contains('Initialization failed').should('not.exist');
    cy.contains('Error:').should('not.exist');
  });

  it('should load the remote course test page', () => {
    // Test the remote course embedding as well
    cy.visit('/vue-skuilder/dbg/remote-crs-embedding.html');

    const consoleErrors: string[] = [];

    cy.window().then((win) => {
      cy.stub(win.console, 'error').callsFake((...args) => {
        const message = args.join(' ');
        consoleErrors.push(message);
      });
    });

    // Wait for initialization
    cy.contains('Interactive study session', { timeout: 10000 }).should('be.visible');

    // Check for "not found" errors
    cy.window().then(() => {
      const notFoundErrors = consoleErrors.filter(msg =>
        msg.toLowerCase().includes('not found')
      );

      if (notFoundErrors.length > 0) {
        throw new Error(`Found "not found" errors in remote course test:\n${notFoundErrors.join('\n')}`);
      }
    });
  });
});
