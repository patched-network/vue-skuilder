# Assessment: Backport Custom Questions Fixes

## Context

The `BACKPORT_CHECKLIST.md` document details 7 changes that were tested in `/flutor` to enable custom questions to work in both standalone mode (`yarn dev`) and studio mode (`yarn studio`). These fixes address:

1. Browser unable to resolve bare imports in dynamically loaded modules
2. Missing view component names for runtime lookup
3. Side-effect import not running (views array staying empty)
4. Incorrect views export format for studio-ui consumption

## Current State Analysis

Branch: `custom-q-packing-updates` (fresh, no commits yet)

### What's Already Fixed

**Partially Fixed:**
- ✅ Vite config: Empty externals array (bundling everything for browser compatibility)
- ✅ Vite config: `keep_classnames: true` in terser options
- ✅ Question classes: Already using `{ name, component }` format in static views
  - `SimpleTextQuestion.views = [{ name: 'SimpleTextQuestionView', component: SimpleTextQuestionView }]`
  - Same for MultipleChoiceQuestion and NumberRangeQuestion

### What's Missing

**Critical Issues (Phase 1):**
1. ❌ **Vite config terser options incomplete**
   - Missing: `keep_fnames: true`
   - Missing: `mangle: { properties: false }`
   - Affects: `/packages/standalone-ui/vite.config.ts` (line 48-50)
   - Affects: `/packages/sk-contributor/vite.config.ts` (line 63-65)

2. ❌ **Views export format in index.ts**
   - Current: `const views: ViewComponent[] = []` (line 55)
   - Expected: `const views: Array<{ name: string; component: ViewComponent }> = []`
   - Missing name extraction logic with warnings
   - Affects: Both packages' `src/questions/index.ts`

3. ❌ **TypeScript interface mismatch**
   - Current: `views: ViewComponent[]` (line 105)
   - Expected: `views: Array<{ name: string; component: ViewComponent }>`
   - Affects: `CustomQuestionsExport` interface in both `index.ts` files

**Important Issues (Phase 2):**
4. ❌ **Side-effect import missing in main.ts**
   - Neither main.ts imports `'./questions/index'` before exampleCourse
   - Current: Line 28 directly imports exampleCourse
   - Expected: Add `import './questions/index';` before line 28
   - Affects: `/packages/standalone-ui/src/main.ts`
   - Affects: `/packages/sk-contributor/src/main.ts`

5. ❌ **Vue components missing defineOptions**
   - None of the Vue components have `defineOptions({ name: '...' })`
   - Required for runtime component lookup
   - Affects: All 3 view components in both packages:
     - SimpleTextQuestionView.vue
     - MultipleChoiceQuestionView.vue
     - NumberRangeQuestionView.vue

**Documentation (Phase 3):**
6. ❌ **README examples outdated**
   - Current README shows old patterns
   - Should document direct inline registration pattern
   - Affects: `/packages/standalone-ui/src/questions/README.md`

## Risk Assessment

### If We Don't Apply These Changes

**Studio mode will likely break:**
- Custom questions won't appear in studio CreateCardView
- Card creation with custom DataShapes may fail
- View components may not be found at runtime
- Minification may mangle static properties (seedData, views, dataShapes)

**Standalone mode may work:**
- Direct imports in main.ts already register course
- No dynamic module loading required
- But builds may still have mangled properties

### If We Apply Changes Incorrectly

**Low risk areas:**
- Terser options (additive, won't break existing code)
- Vue defineOptions (additive, standard Vue 3 pattern)
- TypeScript interface updates (compile-time only)

**Medium risk areas:**
- Views export format change (runtime behavior change)
  - Studio-ui expects `{ name, component }` format
  - If we break this, studio mode will definitely fail
  - But standalone mode doesn't use this export currently

**High risk areas:**
- Side-effect import ordering
  - If views array setup runs too early/late, may cause registration issues
  - But since question classes already have inline views, this is less critical

## Options

### Option 1: Full Sequential Backport
Apply all 6 changes in the priority order from the checklist:
- Phase 1: Changes 1-3 (vite config, views export, interface)
- Phase 2: Changes 4-5 (side-effect import, defineOptions)
- Phase 3: Change 6 (documentation)

**Pros:**
- Complete implementation matching tested flutor state
- Follows documented priority order
- Clear testing checkpoints between phases

**Cons:**
- More changes than strictly necessary
- Includes defensive fixes for problems we may not have

### Option 2: Minimal Critical Path
Apply only the changes that directly affect studio mode:
1. Terser options (keep_fnames, mangle.properties)
2. Views export format + name extraction
3. TypeScript interface update
4. Vue defineOptions in all components

Skip:
- Side-effect import (since classes already have inline views)
- Documentation (do in separate PR)

**Pros:**
- Minimum necessary changes
- Faster to implement and test
- Lower risk of unintended side effects

**Cons:**
- May still have latent issues with view registration
- Documentation stays out of sync

### Option 3: Investigate Before Backporting
First test current state to identify actual failures:
1. Build library mode for both packages
2. Test studio mode integration
3. Only apply fixes for confirmed failures

**Pros:**
- Evidence-based approach
- Don't fix what isn't broken
- Better understanding of actual issues

**Cons:**
- Requires studio-ui setup and testing infrastructure
- May waste time if multiple test cycles needed
- Checklist authors already did this investigation

### Option 4: Full Backport with Verification
Apply all changes but verify each phase:
1. Apply Phase 1, build, verify no breaks
2. Apply Phase 2, build, verify no breaks
3. Apply Phase 3 (docs only)
4. Test both standalone and studio modes

**Pros:**
- High confidence in final state
- Methodical with verification points
- Documents any deviations from checklist

**Cons:**
- Time intensive
- Requires studio mode test setup

## Recommendation

**Option 2: Minimal Critical Path** with selective additions

Apply these specific changes:

**Immediate (Critical):**
1. ✅ Vite config terser options - Add `keep_fnames` and `mangle.properties`
2. ✅ Views export format - Change to `{ name, component }[]` with name extraction
3. ✅ TypeScript interface - Update to match runtime format
4. ✅ Vue defineOptions - Add to all 6 view components (3 per package)

**Deferred (Safe to skip for now):**
5. ⏸️ Side-effect import - Skip because classes already have inline views
6. ⏸️ Documentation updates - Do in separate documentation PR

**Rationale:**
- Question classes already use correct inline pattern, so side-effect import is redundant
- The checklist itself notes change #7 (removing side-effects) should be "future" work
- This gets us to a working state faster with less risk
- We can add the side-effect import later if we discover view registration issues

**Success Criteria:**
After applying changes:
- ✅ Library builds succeed for both packages
- ✅ No minification of static properties (seedData, views, dataShapes)
- ✅ View components have explicit names for runtime lookup
- ✅ Studio-ui can import and parse the views array correctly

**Testing Plan:**
1. Apply changes to standalone-ui first
2. Build library mode: `BUILD_MODE=library yarn workspace @vue-skuilder/standalone-ui build`
3. Verify output in `dist-lib/` has correct structure
4. Replicate to sk-contributor
5. Test integration with studio mode (if available)

## Next Steps

If approved, I will:
1. Create `a.2.plan.md` detailing the specific changes
2. Create `a.3.todo.md` with checklist of files to modify
3. Proceed with implementation in phases
