// packages/common-ui/cypress/component/StudySessionTimer.cy.ts
import StudySessionTimer from '../../src/components/StudySessionTimer.vue';

describe('StudySessionTimer', () => {
  it('renders correctly with default props', () => {
    cy.mount(StudySessionTimer, {
      props: {
        timeRemaining: 180,
        sessionTimeLimit: 5,
      },
    });

    // Check for the circular progress component
    cy.get('[role="progressbar"]').should('exist');

    // Check for the formatted time text (visible in tooltip)
    cy.get('[role="progressbar"]').trigger('mouseenter');
    cy.contains('3:00 left!').should('exist');
  });

  it('changes color when time is low', () => {
    cy.mount(StudySessionTimer, {
      props: {
        timeRemaining: 30, // 30 seconds (below 60 seconds threshold)
        sessionTimeLimit: 5,
      },
    });

    // Check for orange color class (Vuetify uses 'text-orange' with 'darken-3' modifier)
    cy.get('[role="progressbar"]').should('have.class', 'text-orange');

    // Check for the time text
    cy.get('[role="progressbar"]').trigger('mouseenter');
    cy.contains('30 seconds left!').should('exist');
  });

  it('shows button on hover and emits add-time event when clicked', () => {
    const onAddTime = cy.spy().as('onAddTime');

    cy.mount(StudySessionTimer, {
      props: {
        timeRemaining: 180,
        sessionTimeLimit: 5,
        'onAdd-time': onAddTime,
      },
    });

    // Button should appear on hover
    cy.get('[role="progressbar"]').trigger('mouseenter');
    cy.get('button').should('be.visible');

    // Click should emit event
    cy.get('button').click();
    cy.get('@onAddTime').should('have.been.called');
  });

  it('does not show button when time is zero', () => {
    cy.mount(StudySessionTimer, {
      props: {
        timeRemaining: 0,
        sessionTimeLimit: 5,
      },
    });

    // Even on hover, button should not appear
    cy.get('.timer-container').trigger('mouseenter');
    cy.get('button').should('not.exist');
  });

  it('displays correct percentage for progress indicator', () => {
    cy.mount(StudySessionTimer, {
      props: {
        timeRemaining: 150, // 2.5 minutes
        sessionTimeLimit: 5, // 5 minutes
      },
    });

    // Progress should be 50% (2.5 minutes of 5 minutes)
    cy.get('[role="progressbar"]').should('have.attr', 'aria-valuenow', '50');
  });

  it('displays correct percentage when under 60 seconds', () => {
    cy.mount(StudySessionTimer, {
      props: {
        timeRemaining: 30, // 30 seconds
        sessionTimeLimit: 5, // 5 minutes
      },
    });

    // Progress should be 50% (30 seconds of 60 seconds in the final minute)
    cy.get('[role="progressbar"]').should('have.attr', 'aria-valuenow', '50');
  });
});
