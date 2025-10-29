// packages/common-ui/cypress/component/MarkdownRenderer.cy.ts
import MarkdownRenderer from '../../src/components/cardRendering/MarkdownRenderer.vue';
import { markRaw, h } from 'vue';

describe('MarkdownRenderer - Basic Text Formatting', () => {
  it('renders plain markdown text', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'Hello **world**' },
    });

    cy.contains('Hello').should('exist');
    cy.get('strong').should('contain', 'world');
  });

  it('renders emphasis (italic)', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'This is *important*' },
    });

    cy.get('em').should('contain', 'important');
  });

  it('renders markdown links', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '[Google](https://google.com)' },
    });

    cy.get('a').should('have.attr', 'href', 'https://google.com');
    cy.get('a').should('contain', 'Google');
  });

  it('renders blockquotes', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '> This is a quote' },
    });

    cy.get('blockquote').should('contain', 'This is a quote');
  });

  it('renders horizontal rule', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'Before\n\n---\n\nAfter' },
    });

    cy.get('hr').should('exist');
  });
});

describe('MarkdownRenderer - Headings', () => {
  it('renders h1 headings', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '# Heading 1' },
    });

    cy.get('h1').should('contain', 'Heading 1');
  });

  it('renders markdown with headings and content', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '# Quiz\n\nSome content here.' },
    });

    cy.get('h1').should('contain', 'Quiz');
    cy.contains('Some content here.').should('exist');
  });
});

describe('MarkdownRenderer - Lists', () => {
  it('renders unordered lists', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '- Item 1\n- Item 2\n- Item 3' },
    });

    cy.get('ul li').should('have.length', 3);
  });

  it('renders ordered lists', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '1. First\n2. Second\n3. Third' },
    });

    cy.get('ol li').should('have.length', 3);
  });
});

describe('MarkdownRenderer - Code', () => {
  it('renders code blocks', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '```js\nconst x = 1;\n```' },
    });

    cy.get('code').should('exist');
  });

  it('renders inline code', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'Use `console.log()` for debugging' },
    });

    cy.get('.codespan').should('contain', 'console.log()');
  });
});

describe('MarkdownRenderer - Tables', () => {
  it('renders tables', () => {
    const tableMd = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
    `;

    cy.mount(MarkdownRenderer, {
      props: { md: tableMd },
    });

    cy.get('table').should('exist');
    cy.get('thead th').should('have.length', 2);
    cy.get('tbody tr').should('have.length', 2);
  });
});

describe('MarkdownRenderer - FillIn Component (Basic)', () => {
  it('renders fillIn component with basic syntax {{ }}', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'The capital of France is {{ Paris }}.' },
    });

    // Should render fillInInput component
    cy.get('input[type="text"]').should('exist');
  });

  it('renders fillIn in middle of sentence', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'The capital of France is {{ Paris }} and it is beautiful.' },
    });

    cy.contains('The capital of France is').should('exist');
    cy.get('input[type="text"]').should('exist');
    cy.contains('and it is beautiful.').should('exist');
  });

  it('renders fillIn at start of paragraph', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '{{ Paris }} is the capital of France.' },
    });

    cy.get('input[type="text"]').should('exist');
    cy.contains('is the capital of France.').should('exist');
  });

  it('renders fillIn at end of paragraph', () => {
    cy.mount(MarkdownRenderer, {
      props: {
        md: `The capital of France is {{ Paris }}

And it is nice.
`,
      },
    });

    cy.contains('The capital of France is').should('exist');
    cy.get('input[type="text"]').should('exist');
  });
});

describe('MarkdownRenderer - FillIn Component (Multiple Choice)', () => {
  it('renders fillIn component with multiple choice syntax {{ || }}', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'Choose: {{ Paris || London | Berlin | Madrid }} ' },
    });

    // Should render radio/multiple choice blank (underline style)
    cy.get('.underline').should('exist');
  });
});

describe('MarkdownRenderer - FillIn Component (Multiple Blanks)', () => {
  it('renders multiple fillIn blanks in same markdown', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'The {{ capital }} of {{ France }} is {{ Paris }}.' },
    });

    cy.get('input[type="text"]').should('have.length', 3);
  });
});

describe('MarkdownRenderer - Complex Content', () => {
  it('renders markdown with headings and fillIn', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '# Quiz\n\nWhat is {{ answer }}?' },
    });

    cy.get('h1').should('contain', 'Quiz');
    cy.get('input[type="text"]').should('exist');
  });

  it('renders complex markdown with mixed elements', () => {
    const complexMd = `
# Title

This is a paragraph with **bold** and *italic* text.

- List item 1
- List item 2

What is the answer? {{ 42 }}

\`\`\`javascript
const greeting = "Hello";
\`\`\`
    `;

    cy.mount(MarkdownRenderer, {
      props: { md: complexMd },
    });

    cy.get('h1').should('contain', 'Title');
    cy.get('strong').should('contain', 'bold');
    cy.get('em').should('contain', 'italic');
    cy.get('ul li').should('have.length', 2);
    cy.get('input[type="text"]').should('exist');
    cy.get('code').should('exist');
  });
});

describe('MarkdownRenderer - Edge Cases', () => {
  it('handles empty markdown', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '' },
    });

    // Should not error, just render nothing
    cy.get('div').should('exist');
  });

  it('handles markdown with only whitespace', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '   \n\n   ' },
    });

    // Should not error
    cy.get('div').should('exist');
  });
});

describe('MarkdownRenderer - Known Limitations', () => {
  it('DOES NOT render component as final token of document (known bug)', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'The capital of France is {{ Paris }}' },
    });

    // BUG: Component at end of document does not render due to v-if="!last" check
    cy.contains('The capital of France is').should('exist');
    cy.get('input[type="text"]').should('not.exist');

    // This test documents current behavior - if this test fails, the limitation is fixed!
  });

  it('DOES render component when followed by more content', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'The capital of France is {{ Paris }}.' },
    });

    // Works fine when component is not the final token
    cy.contains('The capital of France is').should('exist');
    cy.get('input[type="text"]').should('exist');
  });

  it('DOES render component as last in paragraph (but not document)', () => {
    cy.mount(MarkdownRenderer, {
      props: {
        md: `First paragraph ends with {{ component }}.

Second paragraph here.`,
      },
    });

    // Component renders fine when it's last in paragraph but not last in document
    cy.get('input[type="text"]').should('exist');
    cy.contains('Second paragraph here.').should('exist');
  });
});

describe('MarkdownRenderer - New Component Syntax', () => {
  it('renders custom component with new syntax {{ <componentName /> }}', () => {
    const TestComponent = {
      name: 'TestComponent',
      render() {
        return h('span', { class: 'test-component' }, 'CUSTOM COMPONENT');
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Hello {{ <testComponent /> }} world.',
      },
      global: {
        provide: {
          markdownComponents: {
            testComponent: markRaw(TestComponent),
          },
        },
      },
    });

    cy.contains('Hello').should('exist');
    cy.get('.test-component').should('contain', 'CUSTOM COMPONENT');
    cy.contains('world.').should('exist');
  });

  it('shows error for unknown component', () => {
    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Test {{ <unknownComponent /> }} here.',
      },
    });

    cy.contains('Test').should('exist');
    cy.contains('[Unknown component: unknownComponent]').should('exist');
    cy.contains('here.').should('exist');
  });

  it('renders multiple custom components in same markdown', () => {
    const ComponentA = {
      name: 'ComponentA',
      render() {
        return h('span', { class: 'comp-a' }, 'A');
      },
    };
    const ComponentB = {
      name: 'ComponentB',
      render() {
        return h('span', { class: 'comp-b' }, 'B');
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'First {{ <compA /> }} and second {{ <compB /> }} done.',
      },
      global: {
        provide: {
          markdownComponents: {
            compA: markRaw(ComponentA),
            compB: markRaw(ComponentB),
          },
        },
      },
    });

    cy.get('.comp-a').should('contain', 'A');
    cy.get('.comp-b').should('contain', 'B');
    cy.contains('First').should('exist');
    cy.contains('and second').should('exist');
    cy.contains('done.').should('exist');
  });

  it('mixes old and new syntax in same markdown', () => {
    const TestComponent = {
      name: 'TestComponent',
      render() {
        return h('span', { class: 'test' }, 'CUSTOM');
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Fill in: {{ answer }} and custom: {{ <test /> }} done.',
      },
      global: {
        provide: {
          markdownComponents: {
            test: markRaw(TestComponent),
          },
        },
      },
    });

    cy.get('input[type="text"]').should('exist'); // fillIn (old syntax)
    cy.get('.test').should('contain', 'CUSTOM'); // custom (new syntax)
    cy.contains('Fill in:').should('exist');
    cy.contains('and custom:').should('exist');
    cy.contains('done.').should('exist');
  });

  it('handles whitespace variations in new syntax', () => {
    const TestComponent = {
      name: 'TestComponent',
      render() {
        return h('span', { class: 'test' }, 'OK');
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'A {{<test/>}} B {{ <test/> }} C {{  <test />  }} D.',
      },
      global: {
        provide: {
          markdownComponents: {
            test: markRaw(TestComponent),
          },
        },
      },
    });

    cy.get('.test').should('have.length', 3);
    cy.contains('A').should('exist');
    cy.contains('B').should('exist');
    cy.contains('C').should('exist');
    cy.contains('D.').should('exist');
  });

  it('explicitly renders fillIn with new syntax {{ <fillIn /> }}', () => {
    cy.mount(MarkdownRenderer, {
      props: {
        md: 'What is the answer? {{ <fillIn /> }} End.',
      },
    });

    cy.contains('What is the answer?').should('exist');
    cy.get('input[type="text"]').should('exist');
    cy.contains('End.').should('exist');
  });

  it('DOES NOT work in headings (markdown parser limitation)', () => {
    const BadgeComponent = {
      name: 'BadgeComponent',
      render() {
        return h('span', { class: 'badge' }, 'NEW');
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: '# Title {{ <badge /> }}\n\nSome content.',
      },
      global: {
        provide: {
          markdownComponents: {
            badge: markRaw(BadgeComponent),
          },
        },
      },
    });

    // Markdown parser treats heading content as text-only block
    // Component syntax doesn't get parsed inside headings
    cy.get('h1').should('exist');
    cy.get('.badge').should('not.exist');
    cy.contains('Some content.').should('exist');
  });

  it('DOES NOT work in list items (markdown parser limitation)', () => {
    const IconComponent = {
      name: 'IconComponent',
      render() {
        return h('span', { class: 'icon' }, '✓');
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: '- Item 1 {{ <icon /> }}\n- Item 2 {{ <icon /> }}\n- Item 3',
      },
      global: {
        provide: {
          markdownComponents: {
            icon: markRaw(IconComponent),
          },
        },
      },
    });

    // Markdown parser treats list content as text-only blocks
    // Component syntax doesn't get parsed inside list items
    cy.get('ul li').should('have.length', 3);
    cy.get('.icon').should('not.exist');
  });

  it('preserves component case sensitivity', () => {
    const MyComponent = {
      name: 'MyComponent',
      render() {
        return h('span', { class: 'my-comp' }, 'Works');
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Test {{ <myComponent /> }} here.',
      },
      global: {
        provide: {
          markdownComponents: {
            myComponent: markRaw(MyComponent),
          },
        },
      },
    });

    cy.get('.my-comp').should('contain', 'Works');
  });

  it('handles kebab-case component names', () => {
    const MyComponent = {
      name: 'MyCustomComponent',
      render() {
        return h('span', { class: 'kebab' }, 'Kebab Works');
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Test {{ <my-custom-component /> }} here.',
      },
      global: {
        provide: {
          markdownComponents: {
            'my-custom-component': markRaw(MyComponent),
          },
        },
      },
    });

    cy.get('.kebab').should('contain', 'Kebab Works');
  });
});

describe('MarkdownRenderer - Backward Compatibility After Changes', () => {
  it('old syntax still works unchanged', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'The answer is {{ 42 }} exactly.' },
    });

    cy.contains('The answer is').should('exist');
    cy.get('input[type="text"]').should('exist');
    cy.contains('exactly.').should('exist');
  });

  it('multiple choice syntax still works', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'Pick one: {{ Paris || London | Berlin | Madrid }} now.' },
    });

    cy.contains('Pick one:').should('exist');
    cy.get('.underline').should('exist');
    cy.contains('now.').should('exist');
  });

  it('complex existing content still renders correctly', () => {
    const complexMd = `
# Quiz Time

Answer the following: {{ question }}

- Item 1
- Item 2

\`\`\`js
const x = 1;
\`\`\`

Done.
    `;

    cy.mount(MarkdownRenderer, {
      props: { md: complexMd },
    });

    cy.get('h1').should('contain', 'Quiz Time');
    cy.get('input[type="text"]').should('exist');
    cy.get('ul li').should('have.length', 2);
    cy.get('code').should('exist');
    cy.contains('Done.').should('exist');
  });
});

describe('MarkdownRenderer - Props Parsing', () => {
  it('parses single prop and passes to component', () => {
    const PropComponent = {
      name: 'PropComponent',
      props: ['title'],
      render() {
        return h('div', { class: 'prop-test' }, `Title: ${this.title}`);
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Check this: {{ <propComponent title="Hello World" /> }} done.',
      },
      global: {
        provide: {
          markdownComponents: {
            propComponent: markRaw(PropComponent),
          },
        },
      },
    });

    cy.get('.prop-test').should('contain', 'Title: Hello World');
  });

  it('parses multiple props and passes to component', () => {
    const MultiPropComponent = {
      name: 'MultiPropComponent',
      props: ['name', 'age', 'city'],
      render() {
        return h('div', { class: 'multi-prop' }, `${this.name}, ${this.age}, ${this.city}`);
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Data: {{ <multiProp name="Alice" age="30" city="Paris" /> }} end.',
      },
      global: {
        provide: {
          markdownComponents: {
            multiProp: markRaw(MultiPropComponent),
          },
        },
      },
    });

    cy.get('.multi-prop').should('contain', 'Alice, 30, Paris');
  });

  it('handles whitespace variations in props', () => {
    const WhitespaceComponent = {
      name: 'WhitespaceComponent',
      props: ['a', 'b'],
      render() {
        return h('span', { class: 'ws-test' }, `${this.a}-${this.b}`);
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Test {{<comp a="1" b="2"/>}} and {{ <comp a="3"  b="4" /> }} done.',
      },
      global: {
        provide: {
          markdownComponents: {
            comp: markRaw(WhitespaceComponent),
          },
        },
      },
    });

    cy.get('.ws-test').should('have.length', 2);
    cy.get('.ws-test').first().should('contain', '1-2');
    cy.get('.ws-test').last().should('contain', '3-4');
  });

  it('handles props with spaces in values', () => {
    const SpacePropComponent = {
      name: 'SpacePropComponent',
      props: ['message'],
      render() {
        return h('div', { class: 'space-prop' }, this.message);
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Message: {{ <spaceProp message="Hello there friend" /> }} end.',
      },
      global: {
        provide: {
          markdownComponents: {
            spaceProp: markRaw(SpacePropComponent),
          },
        },
      },
    });

    cy.get('.space-prop').should('contain', 'Hello there friend');
  });

  it('handles props with special characters', () => {
    const SpecialPropComponent = {
      name: 'SpecialPropComponent',
      props: ['fen'],
      render() {
        return h('code', { class: 'special-prop' }, this.fen);
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'FEN: {{ <specialProp fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR" /> }} end.',
      },
      global: {
        provide: {
          markdownComponents: {
            specialProp: markRaw(SpecialPropComponent),
          },
        },
      },
    });

    cy.get('.special-prop').should('contain', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  });

  it('component without props still works (empty props)', () => {
    const NoPropsComponent = {
      name: 'NoPropsComponent',
      render() {
        return h('span', { class: 'no-props' }, 'No props needed');
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Simple: {{ <noProps /> }} done.',
      },
      global: {
        provide: {
          markdownComponents: {
            noProps: markRaw(NoPropsComponent),
          },
        },
      },
    });

    cy.get('.no-props').should('contain', 'No props needed');
  });

  it('mixes components with props and fillIn syntax', () => {
    const PropsComponent = {
      name: 'PropsComponent',
      props: ['value'],
      render() {
        return h('strong', { class: 'has-props' }, this.value);
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Answer {{ question }} then see {{ <propsComp value="Result" /> }} done.',
      },
      global: {
        provide: {
          markdownComponents: {
            propsComp: markRaw(PropsComponent),
          },
        },
      },
    });

    // fillIn input should exist
    cy.get('input[type="text"]').should('exist');
    // Custom component with prop should render
    cy.get('.has-props').should('contain', 'Result');
  });

  it('handles props with numbers in values', () => {
    const NumberPropComponent = {
      name: 'NumberPropComponent',
      props: ['count', 'size'],
      render() {
        return h('span', { class: 'num-prop' }, `Count: ${this.count}, Size: ${this.size}`);
      },
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Numbers: {{ <numProp count="42" size="100" /> }} end.',
      },
      global: {
        provide: {
          markdownComponents: {
            numProp: markRaw(NumberPropComponent),
          },
        },
      },
    });

    cy.get('.num-prop').should('contain', 'Count: 42, Size: 100');
  });

  it('backward compat: text prop still works for fillIn', () => {
    // This test verifies that the existing :text prop binding for fillIn
    // continues to work alongside new props parsing
    cy.mount(MarkdownRenderer, {
      props: {
        md: 'What is {{ the answer }}?',
      },
    });

    cy.get('input[type="text"]').should('exist');
    cy.contains('What is').should('exist');
    cy.contains('?').should('exist');
  });
});

// TEMPORARY: Intentional failing test to verify CI workflow catches test failures
describe('MarkdownRenderer - CI Sanity Check', () => {
  it('INTENTIONAL FAILURE - remove this test after verifying CI catches it', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'This test intentionally fails' },
    });

    // This assertion will fail on purpose
    cy.contains('This text does not exist').should('exist');
  });
});
