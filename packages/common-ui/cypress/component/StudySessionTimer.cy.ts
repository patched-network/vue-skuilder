// packages/common-ui/cypress/component/StudySessionTimer.cy.ts
import StudySessionTimer from '../../src/components/StudySessionTimer.vue';

describe('StudySessionTimer', () => {
  it('renders correctly with default props', () => {
    cy.mount(StudySessionTimer, {
      props: {
        timeRemaining: 180,
        sessionTimeLimit: 5,
        isActive: true,
        showTooltip: true,
      },
    });

    // Check for the circular progress component
    cy.get('[role="progressbar"]').should('exist');

    // Check for the formatted time text
    cy.contains('3:00 left!').should('exist');

    // Verify the button is visible when active
    cy.get('button').should('exist');
    cy.get('.mdi-plus').should('exist');
  });

  it('changes color when time is low', () => {
    cy.mount(StudySessionTimer, {
      props: {
        timeRemaining: 30, // 30 seconds (below 60 seconds threshold)
        sessionTimeLimit: 5,
        isActive: true,
        showTooltip: true,
      },
    });

    // Check for orange color class
    cy.get('[role="progressbar"]').should('exist');
    cy.contains('30 seconds left!').should('exist');
  });

  it('emits add-time event when button is clicked', () => {
    const onAddTime = cy.spy().as('onAddTime');

    cy.mount(StudySessionTimer, {
      props: {
        timeRemaining: 180,
        sessionTimeLimit: 5,
        isActive: true,
        showTooltip: true,
      },
      attrs: {
        onAddTime,
      },
    });

    cy.get('button').click();
    cy.get('@onAddTime').should('have.been.called');
  });

  it('does not show button when timer is not active', () => {
    cy.mount(StudySessionTimer, {
      props: {
        timeRemaining: 180,
        sessionTimeLimit: 5,
        isActive: false,
        showTooltip: true,
      },
    });

    cy.get('button').should('not.exist');
  });
});
