# Implementation Plan: Generic Inline Component Rendering

## Overview
Add support for generic custom inline components in markdown using syntax: `{{ <component-name /> }}`

Leverage Vue's dynamic component rendering with injection pattern for component registration.

## Testing Strategy

**Cypress Component Testing** - Primary testing approach
- Visual verification of component rendering
- Real browser testing with full Vue runtime
- Vuetify support already configured
- Interactive test runner for fast feedback
- Template: `packages/common-ui/cypress/component/StudySessionTimer.cy.ts`

**TDD Approach**:
1. Write tests for **existing** behavior first (baseline)
2. Ensure all tests pass with current implementation
3. Implement new features
4. Write tests for new behavior
5. Ensure all tests still pass (backward compatibility)

## Implementation Steps

### Phase 0: Test Existing Behavior (START HERE)

#### 0. Create Cypress Component Tests for Current MarkdownRenderer
**File**: `packages/common-ui/cypress/component/MarkdownRenderer.cy.ts` (NEW)

**Purpose**: Establish baseline - test existing behavior before making changes

**Test Cases** (all should pass with current implementation):
```typescript
describe('MarkdownRenderer - Existing Behavior', () => {
  it('renders plain markdown text', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'Hello **world**' }
    });
    cy.contains('Hello').should('exist');
    cy.get('strong').should('contain', 'world');
  });

  it('renders fillIn component with basic syntax {{ }}', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'What is the capital? {{ Paris }}' }
    });
    // Should render fillInInput component
    cy.get('input[type="text"]').should('exist');
  });

  it('renders fillIn component with multiple choice syntax {{ || }}', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'Choose: {{ Paris || London | Berlin | Madrid }}' }
    });
    // Should render radio/multiple choice blank
    cy.get('.underline').should('exist'); // fillInInput renders underline for radio
  });

  it('renders multiple fillIn blanks in same markdown', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'The {{ capital }} of {{ France }} is {{ Paris }}' }
    });
    cy.get('input[type="text"]').should('have.length', 3);
  });

  it('renders markdown with headings and fillIn', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '# Quiz\n\nWhat is {{ answer }}?' }
    });
    cy.get('h1').should('contain', 'Quiz');
    cy.get('input[type="text"]').should('exist');
  });

  it('renders markdown with lists', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '- Item 1\n- Item 2\n- Item 3' }
    });
    cy.get('ul li').should('have.length', 3);
  });

  it('renders markdown with code blocks', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: '```js\nconst x = 1;\n```' }
    });
    cy.get('code').should('exist');
  });
});
```

**Run tests**:
```bash
yarn workspace @vue-skuilder/common-ui cypress:open
```

All tests should **pass** before proceeding to Phase 1.

### Phase 1: Core Parsing & Rendering

#### 1. Update Component Parser (`MdTokenRenderer.vue`)
**File**: `packages/common-ui/src/components/cardRendering/MdTokenRenderer.vue`

**Changes**:
- Uncomment and complete the `parsedComponent()` function (lines 169-179)
- Add regex parsing for `{{ <component-name /> }}` syntax
- Keep backward compatibility for `{{ }}` → `fillIn`
- Update `getComponent()` to handle unknown components gracefully

**Implementation**:
```typescript
function parsedComponent(token: MarkedToken): {
  is: string;
  text: string;
} {
  let text = '';
  if ('text' in token && typeof token.text === 'string') {
    text = token.text;
  } else if ('raw' in token && typeof token.raw === 'string') {
    text = token.raw;
  }

  // Try to parse: {{ <component-name /> }}
  const match = text.match(/^\{\{\s*<([\w-]+)\s*\/>\s*\}\}$/);

  if (match) {
    return {
      is: match[1],  // component-name
      text: '',
    };
  }

  // Backward compatible: {{ }} or {{ || }} → fillIn
  return {
    is: 'fillIn',
    text,
  };
}

function getComponent(componentName: string) {
  const component = components[componentName as keyof typeof components];

  if (!component) {
    console.warn(`Unknown markdown component: ${componentName}. Available: ${Object.keys(components).join(', ')}`);
    // Return null or a fallback error component
    return null;
  }

  return component;
}
```

#### 2. Add Injection Support (`MdTokenRenderer.vue`)
**File**: `packages/common-ui/src/components/cardRendering/MdTokenRenderer.vue`

**Changes**:
- Import `inject` from Vue
- Inject `markdownComponents` registry
- Merge injected components with built-in components

**Implementation**:
```typescript
import { markRaw, inject } from 'vue';

// Inject provided components (defaults to empty object)
const providedComponents = inject('markdownComponents', {});

// Merge built-in with injected
const components = {
  fillIn: markRaw(FillInInput),
  ...providedComponents,
};
```

#### 3. Handle Missing Components in Template
**File**: `packages/common-ui/src/components/cardRendering/MdTokenRenderer.vue`

**Changes**:
Update line 6 to handle null component:

```vue
<span v-if="isComponent(token)">
  <component
    v-if="!last && getComponent(parsedComponent(token).is)"
    :is="getComponent(parsedComponent(token).is)"
    :text="parsedComponent(token).text"
  />
  <span v-else-if="!getComponent(parsedComponent(token).is)" class="error--text">
    [Unknown component: {{ parsedComponent(token).is }}]
  </span>
</span>
```

### Phase 2: Component Registration

#### 4. Create Inline Components Export (`@vue-skuilder/courseware`)
**File**: `packages/courseware/src/components/inline/index.ts` (NEW)

**Implementation**:
```typescript
import { markRaw } from 'vue';
import ChessBoard from '../../chess/components/ChessBoard.vue';
import MusicScoreRender from '../MusicScoreRender.vue';

/**
 * Components available for inline markdown rendering via {{ <component /> }}
 */
export const inlineMarkdownComponents = {
  chessBoard: markRaw(ChessBoard),
  musicScore: markRaw(MusicScoreRender),
};

export type InlineComponentName = keyof typeof inlineMarkdownComponents;
```

#### 5. Export from Courseware Main
**File**: `packages/courseware/src/index.ts`

**Changes**:
Add export for inline components:
```typescript
export { inlineMarkdownComponents } from './components/inline';
export type { InlineComponentName } from './components/inline';
```

#### 6. Register in Platform-UI
**File**: `packages/platform-ui/src/main.ts`

**Changes**:
Import and provide components:
```typescript
import { inlineMarkdownComponents } from '@vue-skuilder/courseware';

// ... after app creation
app.provide('markdownComponents', inlineMarkdownComponents);
```

#### 7. Register in Standalone-UI
**File**: `packages/standalone-ui/src/main.ts`

**Changes**:
Same as platform-ui - provide components at app level.

### Phase 3: Type Safety (Optional but Recommended)

#### 8. Add Typed Injection Key
**File**: `packages/common/src/types.ts`

**Implementation**:
```typescript
import { InjectionKey, Component } from 'vue';

export type MarkdownComponentRegistry = Record<string, Component>;

export const MARKDOWN_COMPONENTS_KEY: InjectionKey<MarkdownComponentRegistry>
  = Symbol('markdownComponents');
```

**Update MdTokenRenderer.vue**:
```typescript
import { MARKDOWN_COMPONENTS_KEY } from '@vue-skuilder/common';

const providedComponents = inject(MARKDOWN_COMPONENTS_KEY, {});
```

### Phase 4: Test New Behavior

#### 9. Add Cypress Tests for New Component Syntax
**File**: `packages/common-ui/cypress/component/MarkdownRenderer.cy.ts` (UPDATE)

**Add new test suite for new features**:
```typescript
describe('MarkdownRenderer - New Component Syntax', () => {
  it('renders custom component with new syntax {{ <componentName /> }}', () => {
    const TestComponent = {
      name: 'TestComponent',
      template: '<span class="test-component">CUSTOM COMPONENT</span>',
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Hello {{ <testComponent /> }} world',
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
    cy.contains('world').should('exist');
  });

  it('shows error for unknown component', () => {
    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Test {{ <unknownComponent /> }}',
      },
    });

    cy.contains('[Unknown component: unknownComponent]').should('exist');
  });

  it('renders multiple custom components in same markdown', () => {
    const ComponentA = {
      template: '<span class="comp-a">A</span>',
    };
    const ComponentB = {
      template: '<span class="comp-b">B</span>',
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: '{{ <compA /> }} and {{ <compB /> }}',
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
  });

  it('mixes old and new syntax', () => {
    const TestComponent = {
      template: '<span class="test">TEST</span>',
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: 'Fill in: {{ answer }} and custom: {{ <test /> }}',
      },
      global: {
        provide: {
          markdownComponents: {
            test: markRaw(TestComponent),
          },
        },
      },
    });

    cy.get('input[type="text"]').should('exist'); // fillIn
    cy.get('.test').should('contain', 'TEST'); // custom
  });

  it('handles whitespace variations in new syntax', () => {
    const TestComponent = {
      template: '<span class="test">OK</span>',
    };

    cy.mount(MarkdownRenderer, {
      props: {
        md: '{{<test/>}} {{ <test/> }} {{  <test />  }}',
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
  });

  it('backward compatibility: old syntax still works after changes', () => {
    cy.mount(MarkdownRenderer, {
      props: { md: 'Old: {{ answer }} and {{ choice || a | b | c }}' }
    });

    cy.get('input[type="text"]').should('have.length', 1);
    cy.get('.underline').should('have.length', 1);
  });
});
```

#### 10. Optional: Unit Tests for Helper Functions
**File**: `packages/common-ui/src/components/cardRendering/MarkdownRendererHelpers.spec.ts` (NEW)

**Purpose**: Test parsing logic in isolation (Vitest)

```typescript
import { describe, it, expect } from 'vitest';
import { splitByDelimiters, containsComponent, isComponent } from './MarkdownRendererHelpers';

describe('splitByDelimiters', () => {
  it('splits text by delimiters', () => {
    expect(splitByDelimiters('a{{b}}c', '{{', '}}')).toEqual(['a', '{{b}}', 'c']);
  });

  it('handles multiple delimited sections', () => {
    expect(splitByDelimiters('a{{b}}c{{d}}e', '{{', '}}')).toEqual(['a', '{{b}}', 'c', '{{d}}', 'e']);
  });
});

describe('containsComponent', () => {
  it('returns true for text with {{ }}', () => {
    expect(containsComponent({ type: 'text', raw: 'foo {{ bar }} baz' })).toBe(true);
  });

  it('returns false for text without {{ }}', () => {
    expect(containsComponent({ type: 'text', raw: 'foo bar baz' })).toBe(false);
  });
});
```

#### 11. Integration Test with BlanksCard
**File**: `packages/courseware/src/default/questions/fillIn/fillIn.cy.ts` (NEW)

**Purpose**: Test full BlanksCard integration

```typescript
describe('BlanksCard with MarkdownRenderer', () => {
  it('renders BlanksCard question with fillIn input', () => {
    const cardData = [{
      Input: 'What is the capital of France? {{ Paris }}',
    }];

    cy.mount(FillInView, {
      props: {
        data: cardData,
      },
    });

    cy.contains('What is the capital of France?').should('exist');
    cy.get('input[type="text"]').should('exist');
  });
});
```

### Phase 5: Documentation

#### 12. Update BlanksCard Documentation
Document the new syntax in appropriate README or docs file.

#### 13. Create Inline Component Authoring Guide
**File**: `docs/inline-components.md` or similar

**Content**:
- Available components
- Syntax examples
- How to add new components
- Component requirements (props, etc.)

## Backward Compatibility

### Guarantees
1. **Existing syntax continues to work**: `{{ }}` and `{{ || }}` still render fillIn
2. **Existing BlanksCard questions unchanged**: All current content works as-is
3. **No breaking changes**: New feature is opt-in

### Migration Path
No migration needed - old syntax is permanently supported.

## Example Usage

### Before (current):
```markdown
What is the capital of France? {{ Paris }}

Multiple choice: {{ Paris | Lyon || Berlin | London | Madrid }}
```

### After (both work):
```markdown
What is the capital of France? {{ Paris }}

Or explicitly: What is the capital of France? {{ <fillIn /> }}

With chess: Find the best move: {{ <chessBoard /> }}
```

## Future Enhancements (Phase 2)

### Props Support
Extend parser to support props:
```markdown
{{ <chessBoard fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR" /> }}
{{ <musicScore notes="C D E F G" /> }}
```

**Parser Extension**:
```typescript
function parseComponentSyntax(text: string): { name: string; props: Record<string, string> } {
  const match = text.match(/^\{\{\s*<([\w-]+)\s*(.*?)\s*\/>\s*\}\}$/);
  if (!match) return null;

  const name = match[1];
  const attrsString = match[2];
  const props: Record<string, string> = {};

  // Simple attribute parsing: key="value"
  const attrRegex = /([\w-]+)="([^"]*)"/g;
  let attrMatch;

  while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
    props[attrMatch[1]] = attrMatch[2];
  }

  return { name, props };
}
```

**Component Rendering**:
```vue
<component
  :is="componentData.name"
  v-bind="componentData.props"
/>
```

## Risks & Mitigations

### Risk 1: Component Not Registered
**Mitigation**: Clear error message, graceful degradation (show component name as text)

### Risk 2: Name Collision
**Mitigation**: Document reserved names, namespacing convention (e.g., `chess-board` not `board`)

### Risk 3: Props Security (future)
**Mitigation**: Whitelist allowed props per component, validate values

### Risk 4: Performance
**Mitigation**: Keep component registry small, lazy load heavy components

## Success Criteria

✅ Old `{{ }}` syntax continues to work
✅ New `{{ <component-name /> }}` syntax works
✅ Unknown components show helpful error
✅ Components can be registered from any package
✅ Multiple components in same markdown work
✅ All existing tests pass
✅ New tests added for new functionality
✅ Documentation updated

## Estimated Effort

- Phase 0: ~1-2 hours (test existing behavior - START HERE)
- Phase 1: ~2 hours (core parsing)
- Phase 2: ~1 hour (registration)
- Phase 3: ~30 min (type safety)
- Phase 4: ~1 hour (test new behavior)
- Phase 5: ~1 hour (docs)

**Total**: ~6.5-8 hours
