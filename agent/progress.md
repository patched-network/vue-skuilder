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

## 2025-10-28 - Phase 4: Test New Component Syntax

**Goal**: Add comprehensive Cypress tests for new `{{ <component-name /> }}` syntax

### Testing Challenges & Solutions

**Challenge 1: Vue Template Compilation**
- Test components initially used string `template` option
- Error: "Component provided template option but runtime compilation is not supported"
- Cypress uses Vue's runtime-only build (no template compiler)
- **Solution**: Changed all test components to use render functions with `h()`

**Challenge 2: Provide/Inject in Cypress**
- Custom components passed via `global.provide` weren't being injected
- Initial attempt to manually handle provide in mount helper didn't work
- **Solution**: Vue's provide/inject works correctly; issue was template compilation (Challenge 1)

### Tests Added

**File**: `packages/common-ui/cypress/component/MarkdownRenderer.cy.ts`

**New test groups**:
1. **New Component Syntax** (8 tests)
   - Renders custom component with `{{ <componentName /> }}`
   - Shows error for unknown components
   - Renders multiple custom components
   - Mixes old and new syntax
   - Handles whitespace variations
   - Explicitly renders fillIn with new syntax
   - Case sensitivity and kebab-case support

2. **Backward Compatibility After Changes** (3 tests)
   - Old syntax still works unchanged
   - Multiple choice syntax still works
   - Complex existing content still renders correctly

3. **Known Limitations** (updated)
   - Added test documenting markdown parser limitations
   - Components work in paragraphs, not in headings/lists (markdown spec)
   - Final token limitation already documented

### Testing Results

**All tests passing**: ✅ 39/39 tests

**Test coverage**:
- ✅ Basic markdown formatting (5 tests)
- ✅ Headings (2 tests)
- ✅ Lists (2 tests)
- ✅ Code blocks (2 tests)
- ✅ Tables (1 test)
- ✅ FillIn component - basic (4 tests)
- ✅ FillIn component - multiple choice (1 test)
- ✅ FillIn component - multiple blanks (1 test)
- ✅ Complex content (2 tests)
- ✅ Edge cases (2 tests)
- ✅ Known limitations (4 tests)
- ✅ New component syntax (8 tests)
- ✅ Backward compatibility (3 tests)

### Known Limitations Documented

1. **Components cannot end document** (v-if="!last" check) - Chesterton's Fence
2. **Components don't work in headings/lists** - Markdown parser treats these as text-only blocks

**Files Modified**:
- ✅ Updated: `packages/common-ui/cypress/component/MarkdownRenderer.cy.ts`
  - Added 11 new tests for new syntax
  - All using render functions instead of template strings
  - Comprehensive coverage of features and edge cases

- ✅ Created: `packages/common-ui/cypress/component/MdTokenRenderer.cy.ts`
  - Direct component test (debugging aid)

- ✅ Updated: `packages/common-ui/cypress/support/component.js`
  - Added provide directive handling (though ultimately unnecessary)

**Status**: Phase 4 complete - All tests passing, new functionality verified

---

## Next

**Current Phase**: Phase 4 - Test New Behavior (complete)

**Next Step**: Move to Phase 2 - Component Registration

**Reference**: See [plan.md - Phase 2](./plan.md#phase-2-component-registration)

**Todo**:
- [ ] Create inline components export in courseware package
- [ ] Export from courseware main index
- [ ] Register components in platform-ui
- [ ] Register components in standalone-ui
- [ ] Build and test integration

**After Phase 2 Complete**: Feature fully functional with example components available

See [plan.md - Phase 2](./plan.md#phase-2-component-registration) for details.
