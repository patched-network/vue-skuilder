// packages/common-ui/cypress/component/MarkdownRenderer.cy.ts
import MarkdownRenderer from '../../src/components/cardRendering/MarkdownRenderer.vue';

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
