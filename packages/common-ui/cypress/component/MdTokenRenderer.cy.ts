// Test MdTokenRenderer directly to debug provide/inject
import MdTokenRenderer from '../../src/components/cardRendering/MdTokenRenderer.vue';
import { markRaw, h } from 'vue';

describe('MdTokenRenderer - Direct Component Test', () => {
  it('can inject provided components', () => {
    const TestComponent = {
      name: 'TestComponent',
      render() {
        return h('span', { class: 'injected' }, 'INJECTED');
      },
    };

    const testToken = {
      type: 'text' as const,
      raw: '{{ <testComponent /> }}',
      text: '{{ <testComponent /> }}',
    };

    cy.mount(MdTokenRenderer, {
      props: {
        token: testToken,
        last: false,
      },
      global: {
        provide: {
          markdownComponents: {
            testComponent: markRaw(TestComponent),
          },
        },
      },
    });

    // Check if component rendered
    cy.get('.injected').should('contain', 'INJECTED');
  });
});
