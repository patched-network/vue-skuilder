# Progress Log: Generic Inline Component Rendering

Running record of implementation progress against [plan.md](./plan.md)

---

## 2025-10-28 - Phase 0: Baseline Testing

### Created Cypress Component Tests for Existing Behavior

**Goal**: Establish baseline tests for current MarkdownRenderer functionality before making changes

**Actions**:
- Created `/packages/common-ui/cypress/component/MarkdownRenderer.cy.ts`
- Organized tests into 11 logical groups:
  - Basic Text Formatting (bold, italic, links, blockquotes, hr)
  - Headings
  - Lists (ordered and unordered)
  - Code (blocks and inline)
  - Tables
  - FillIn Component (Basic) - single blanks at different positions
  - FillIn Component (Multiple Choice) - `{{ || }}` syntax
  - FillIn Component (Multiple Blanks)
  - Complex Content - mixed elements
  - Edge Cases - empty/whitespace markdown
  - Known Limitations - documented bugs

**Discoveries**:

1. **Missing Pinia in Cypress Setup**
   - `fillInInput` component (via `BaseUserInput`) requires Pinia store
   - Error: "getActivePinia() was called but there was no active Pinia"
   - Fixed by adding Pinia to `/packages/common-ui/cypress/support/component.js`
   - Creates fresh Pinia instance for each test (proper isolation)

2. **Known Limitation: Components Cannot End Document**
   - Components cannot be the final token of entire markdown document
   - Due to `v-if="!last"` check in `MdTokenRenderer.vue:13`
   - Components CAN be last token in a paragraph (just not whole document)
   - Reason unclear but necessary historically (Chesterton's Fence)
   - Workaround: Add trailing punctuation, whitespace, or newline
   - Documented in code comment (`MdTokenRenderer.vue:5-11`)
   - Test explicitly asserts broken behavior with `.should('not.exist')`
   - If limitation is ever fixed, test will fail and alert developer

**Files Modified**:
- ✅ Created: `packages/common-ui/cypress/component/MarkdownRenderer.cy.ts`
- ✅ Updated: `packages/common-ui/cypress/support/component.js` (added Pinia)
- ✅ Updated: `packages/common-ui/src/components/cardRendering/MdTokenRenderer.vue` (added comment)

**Test Organization**:
- Tests separated into logical `describe()` blocks
- Each group can be run independently in Cypress UI
- Easy to isolate and debug specific functionality

**Status**: Tests created, Pinia configured, known limitation documented

---

## 2025-10-28 - Phase 1: Core Parsing & Rendering

**Goal**: Implement component name parsing, injection support, and graceful error handling

### 1. Updated Component Parser

**File**: `packages/common-ui/src/components/cardRendering/MdTokenRenderer.vue:172-200`

**Changes**:
- Replaced commented sketch code with actual implementation
- Added regex to parse `{{ <component-name /> }}` syntax
- Regex: `/^\{\{\s*<([\w-]+)\s*\/>\s*\}\}$/`
- Handles whitespace variations: `{{<name/>}}`, `{{ <name /> }}`, etc.
- Maintains backward compatibility: unparsed `{{ }}` → `fillIn` component
- Returns `{ is: componentName, text: '' }` for new syntax
- Returns `{ is: 'fillIn', text }` for legacy syntax

### 2. Added Injection Support

**File**: `packages/common-ui/src/components/cardRendering/MdTokenRenderer.vue:133-142`

**Changes**:
- Imported `inject` from Vue
- Added: `const providedComponents = inject<Record<string, any>>('markdownComponents', {})`
- Merged injected components with built-in: `{ fillIn: markRaw(FillInInput), ...providedComponents }`
- Defaults to empty object if no components provided
- Allows packages to register custom components at app level

### 3. Handled Unknown Components Gracefully

**File**: `packages/common-ui/src/components/cardRendering/MdTokenRenderer.vue`

**Changes in `getComponent()` function (lines 206-217)**:
- Added null check for unknown components
- Console warning with helpful message showing available components
- Returns `null` for unknown components

**Changes in template (lines 13-20)**:
- Updated component rendering conditions
- Added: `v-if="!last && getComponent(parsedComponent(token).is)"`
- Added error display: `<span v-else-if="!last && !getComponent(...)" class="error--text">`
- Shows: `[Unknown component: componentName]` for missing components

### Testing Results

**Build**: ✅ Success
```
dist/common-ui.es.js   584.59 kB │ gzip: 123.86 kB
dist/common-ui.umd.js  302.90 kB │ gzip: 87.95 kB
```

**Tests**: ✅ All 25 tests passing
- Backward compatibility maintained
- All existing fillIn syntax still works
- Known limitations still documented and tested

**Files Modified**:
- ✅ Updated: `packages/common-ui/src/components/cardRendering/MdTokenRenderer.vue`
  - Parsing function (lines 172-200)
  - Injection setup (lines 130-142)
  - Error handling (lines 206-217, 13-20)

**Status**: Phase 1 complete - Core functionality implemented and tested

---

## Next

**Current Phase**: Phase 1 - Core Parsing & Rendering (complete)

**Next Step**: Add Cypress tests for new component syntax, then move to Phase 2

**Reference**: See [plan.md - Phase 4](./plan.md#phase-4-test-new-behavior)

**Todo**:
- [ ] Add Cypress test suite for new `{{ <component-name /> }}` syntax
- [ ] Test with custom injected components
- [ ] Test unknown component error handling
- [ ] Test whitespace variations
- [ ] Test mixed old/new syntax

**After Tests Pass**: Move to Phase 2 - Component Registration
- Create inline components export in courseware package
- Export from courseware main index
- Register in platform-ui and standalone-ui

See [plan.md - Phase 2](./plan.md#phase-2-component-registration) for details.
