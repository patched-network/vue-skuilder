# Assessment: Generic Custom Inline Component Rendering for BlanksCard

## Current State

### Existing Component Rendering System
The markdown rendering system already has infrastructure for inline custom components:

**Location**: `packages/common-ui/src/components/cardRendering/`

**Key Files**:
- `MarkdownRenderer.vue` - Entry point, lexes markdown tokens
- `MdTokenRenderer.vue` - Renders individual tokens, handles component insertion
- `MarkdownRendererHelpers.ts` - Utilities for splitting on `{{ }}` delimiters

**Current Implementation** (`MdTokenRenderer.vue:128-131, 165-198`):
```typescript
const components = {
  fillIn: markRaw(FillInInput),
  // Add other dynamic components here
};

function parsedComponent(token: MarkedToken): { is: string; text: string } {
  // Lines 169-179: Commented-out sketch showing intent to parse component names
  // Currently hardcoded to always return 'fillIn'
  return {
    is: 'fillIn',
    text,
  };
}
```

**Current Syntax**:
- `{{ }}` - Renders as fillInInput (text input)
- `{{ || }}` - Renders as fillInInput (radio/multiple choice)
- Full syntax: `{{answer1|answer2||distractor1|distractor2}}`

### How It Works Now
1. `BlanksCard` constructor parses `{{ }}` sections for answers/distractors
2. Replaces them with simplified tokens: `{{ }}` or `{{ || }}`
3. `MarkdownRendererHelpers.splitByDelimiters()` splits on `{{` and `}}`
4. `MdTokenRenderer` identifies component tokens and renders `fillIn` component
5. `fillInInput` component receives the text prop and determines rendering mode

## Proposed Enhancement

Add support for generic component syntax: `{{ <component-name /> }}`

### Use Cases
1. **Rich inline widgets** - Embed chess diagrams, piano keyboards, or other interactive elements inline
2. **Specialized inputs** - Math equation editors, drawing canvases, audio recorders
3. **Display components** - Inline charts, badges, icons, formatted data
4. **Content reuse** - Share specialized rendering logic across question types

## Implementation Options

### Option 1: Component Name Parsing with Static Registry ⭐
**Approach**: Parse component names from syntax, maintain explicit component registry

**Changes Required**:
```typescript
// In MdTokenRenderer.vue
const components = {
  fillIn: markRaw(FillInInput),
  chessBoard: markRaw(ChessBoard),
  piano: markRaw(PianoDisplay),
  // etc...
};

function parsedComponent(token: MarkedToken): { is: string; text: string } {
  const text = extractText(token);

  // Parse: {{ <componentName /> }}
  const match = text.match(/^\{\{\s*<(\w+(?:-\w+)*)\s*\/>\s*\}\}$/);

  if (match) {
    return { is: match[1], text: '' };
  }

  // Fallback: {{ }} -> fillIn (backward compatible)
  return { is: 'fillIn', text };
}
```

**Pros**:
- Simple implementation
- Explicit security (only registered components allowed)
- Easy to understand and maintain
- Backward compatible with existing `{{ }}` syntax
- Clear error messages for unknown components

**Cons**:
- Requires updating registry for each new component
- Less flexible than dynamic registration
- Monorepo coupling (common-ui needs to know about courseware components)

**Backward Compatibility**: ✅ Excellent
- Existing `{{ }}` continues to work as fillIn
- New syntax is opt-in

---

### Option 2: Dynamic Component Discovery
**Approach**: Allow packages to register components via provide/inject or global registry

**Changes Required**:
```typescript
// In courseware package
export const customMarkdownComponents = {
  chessBoard: ChessBoard,
  piano: PianoDisplay,
};

// In MdTokenRenderer.vue
const providedComponents = inject('markdownComponents', {});
const components = {
  fillIn: markRaw(FillInInput),
  ...providedComponents,
};
```

**Pros**:
- Decoupled - packages can register their own components
- More flexible and extensible
- No need to modify common-ui for new components

**Cons**:
- More complex dependency injection setup
- Harder to track what components are available
- Potential for naming collisions
- More difficult debugging

**Backward Compatibility**: ✅ Good with careful implementation

---

### Option 3: Full XML-Like Syntax with Props
**Approach**: Parse complete component syntax including props

**Example Syntax**:
```markdown
{{ <chess-board fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR" size="small" /> }}
{{ <piano-keyboard highlight="C,E,G" octaves="2" /> }}
```

**Changes Required**:
- XML parser for component syntax
- Type-safe props extraction
- Component prop validation

**Pros**:
- Maximum flexibility
- Rich component configuration
- Future-proof design
- Familiar XML/JSX-like syntax

**Cons**:
- Significant parsing complexity
- Type safety challenges
- Security concerns (prop injection)
- Larger implementation scope

**Backward Compatibility**: ⚠️ Requires careful handling

---

### Option 4: Hybrid - Name Parsing Now, Props Later
**Approach**: Implement Option 1 with parser designed to support future props

**Phase 1**: Support `{{ <component-name /> }}`
**Phase 2** (future): Extend to `{{ <component-name prop="value" /> }}`

**Parser Design**:
```typescript
interface ParsedComponent {
  name: string;
  props: Record<string, string>; // Empty for phase 1
  text: string;
}

function parseComponentSyntax(text: string): ParsedComponent | null {
  // Phase 1: Match self-closing tag without props
  const simpleMatch = text.match(/^\{\{\s*<([\w-]+)\s*\/>\s*\}\}$/);
  if (simpleMatch) {
    return { name: simpleMatch[1], props: {}, text: '' };
  }

  // Future: Add prop parsing here

  return null;
}
```

**Pros**:
- Incremental implementation
- Clean migration path
- Backward compatible now, extensible later
- Parser abstraction enables future enhancement

**Cons**:
- Some upfront design for features not immediately used
- Risk of over-engineering

**Backward Compatibility**: ✅ Excellent

## Key Considerations

### 1. Backward Compatibility
**Critical**: Existing `{{ }}` and `{{ || }}` syntax must continue working exactly as before.

**Test Coverage Needed**:
- Existing BlanksCard questions render correctly
- Fill-in inputs still receive proper text props
- Multiple choice blanks still work

### 2. Security
**Concern**: Prevent arbitrary component injection

**Solution**: Whitelist-based registry
```typescript
function getComponent(componentName: string) {
  const component = components[componentName];
  if (!component) {
    console.warn(`Unknown component: ${componentName}`);
    return null; // or a fallback component showing the error
  }
  return component;
}
```

### 3. Type Safety
Components should have proper TypeScript types for their props:
```typescript
type RegisteredComponent = {
  fillIn: typeof FillInInput;
  chessBoard: typeof ChessBoard;
  // ...
};

const components: Record<keyof RegisteredComponent, Component> = {
  fillIn: markRaw(FillInInput),
  chessBoard: markRaw(ChessBoard),
};
```

### 4. Error Handling
What should happen when:
- Unknown component name? → Log warning, render nothing (or error component)
- Malformed syntax? → Fallback to text rendering
- Component throws error? → Vue error boundary should handle

### 5. Documentation for Content Authors
Need to document:
- Available components
- Syntax for using each
- What props each component accepts (future)
- Examples

### 6. Component Availability Context
Challenge: Different question types might need different components available.

**Potential Solutions**:
- Global registry (all components always available)
- Context-specific registry (provide from question view)
- Hybrid (base + question-specific)

## Recommendation

**Implement Option 1 (Component Name Parsing with Static Registry)** with elements from Option 4 (future-friendly parser design).

### Rationale
1. **Lowest Risk**: Simple, well-scoped change with clear backward compatibility
2. **Immediate Value**: Enables rich inline components without over-engineering
3. **Maintainable**: Easy to understand and debug
4. **Security**: Explicit whitelist prevents injection attacks
5. **Foundation**: Can evolve to Option 4 if/when props are needed

### Suggested Phasing

**Phase 1** (Immediate):
- Implement component name parsing in `parsedComponent()`
- Keep static registry in `MdTokenRenderer.vue`
- Add 2-3 example components to demonstrate capability
- Ensure backward compatibility tests pass
- Document the new syntax

**Phase 2** (Future, if needed):
- Extend parser to support props
- Add prop type validation
- Consider dynamic component registration if monorepo coupling becomes problematic

### Initial Component Candidates
Good first components to add to the registry:
- `fillIn` - (already exists)
- `audio-player` - Inline audio playback
- `image` - Inline image display with sizing
- `icon` - Material Design icons
- `badge` - Colored badge/chip display

These are simple, safe, and demonstrate the capability without complex dependencies.
