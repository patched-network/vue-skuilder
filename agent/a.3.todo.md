# Todo: Backport Custom Questions Fixes with CI Verification

## Phase 1: Backport Critical Changes to standalone-ui

### 1.1 Vite Config - Terser Options
- [x] Open `packages/standalone-ui/vite.config.ts`
- [x] Locate `terserOptions` in library build config (around line 48-50)
- [x] Add `keep_fnames: true`
- [x] Add `mangle: { properties: false }`
- [x] Verify syntax is correct
- [x] Sync same changes to `packages/cli/src/utils/template.ts` (line ~193)
  - **Why:** CLI uses template.ts to generate vite.config.ts for scaffolded projects
  - **CI Check:** Automated check ensures these stay in sync

### 1.2 Views Export Format - index.ts
- [x] Open `packages/standalone-ui/src/questions/index.ts`
- [x] Change line 55: `const views: ViewComponent[]` to `const views: Array<{ name: string; component: ViewComponent }>`
- [x] Replace views collection logic (lines 56-65) with name extraction pattern:
  ```typescript
  questionClass.views.forEach((view) => {
    const viewName = (view as any).name || (view as any).__name;
    if (viewName) {
      if (!views.find((existing) => existing.name === viewName)) {
        views.push({ name: viewName, component: view });
      }
    } else {
      console.warn('[allCustomQuestions] View component missing name property:', view);
    }
  });
  ```

### 1.3 TypeScript Interface - index.ts
- [x] In same file, locate `CustomQuestionsExport` interface (line 99-114)
- [x] Change line 105: `views: ViewComponent[]` to `views: Array<{ name: string; component: ViewComponent }>`

### 1.4 Test Build (DEFERRED)
- [ ] Run: `BUILD_MODE=library yarn workspace @vue-skuilder/standalone-ui build`
- [ ] Verify build succeeds
- [ ] Inspect `packages/standalone-ui/dist-lib/questions.mjs` for correct output

## Phase 2: Add Component Names to standalone-ui

### 2.1 SimpleTextQuestionView.vue
- [x] Open `packages/standalone-ui/src/questions/SimpleTextQuestionView.vue`
- [x] Add import if not present: `import { defineOptions } from 'vue';`
- [x] Add after imports (before props):
  ```typescript
  defineOptions({
    name: 'SimpleTextQuestionView'
  });
  ```

### 2.2 MultipleChoiceQuestionView.vue
- [x] Open `packages/standalone-ui/src/questions/MultipleChoiceQuestionView.vue`
- [x] Add defineOptions import
- [x] Add: `defineOptions({ name: 'MultipleChoiceQuestionView' });`

### 2.3 NumberRangeQuestionView.vue
- [x] Open `packages/standalone-ui/src/questions/NumberRangeQuestionView.vue`
- [x] Add defineOptions import
- [x] Add: `defineOptions({ name: 'NumberRangeQuestionView' });`

### 2.4 Test Build Again (DEFERRED)
- [ ] Run: `BUILD_MODE=library yarn workspace @vue-skuilder/standalone-ui build`
- [ ] Verify build succeeds
- [ ] Check that component names are preserved in output

## Phase 3: Side-Effect Import to standalone-ui (OMITTED)

**DECISION:** This phase was omitted because the side-effect import is not needed.

**Rationale:**
- Question classes already have inline view registration (e.g., `SimpleTextQuestion.views = [{ name, component }]`)
- No additional setup code exists in `index.ts` that needs to run
- BACKPORT_CHECKLIST #7 even recommends removing side-effects as "future" work
- We're already using the preferred direct inline pattern (#5)

**Risk:** If tests fail with "view not found" errors, we may need to add this back. But current analysis indicates it's redundant.

### 3.1 Main.ts Import
- [x] ~~Add `import './questions/index';`~~ OMITTED (not needed)

### 3.2 Test Dev Mode (DEFERRED)
- [ ] Run: `yarn workspace @vue-skuilder/standalone-ui dev`
- [ ] Navigate to http://localhost:6173
- [ ] Verify app loads without errors
- [ ] Check browser console for warnings

## Phase 4: sk-contributor Package (REMOVED)

**DECISION:** The sk-contributor package never made it off the ground and is being removed from the monorepo.

### 4.1 Remove Package
- [ ] User will execute: `git rm -r packages/sk-contributor`
- [ ] Update workspace references if needed (package.json, tsconfig, etc.)

**Note:** All backport changes were only applied to standalone-ui. If sk-contributor is revived in the future, it would need the same changes applied.

## Phase 5: Update Documentation

### 5.1 Standalone-ui README
- [x] Open `packages/standalone-ui/src/questions/README.md`
- [x] Update examples to show `defineOptions({ name: '...' })` pattern
- [x] Update examples to show direct inline view registration with `markRaw()`
- [x] Add note about `markRaw()` for Vue components
- [x] Add note about `{ name, component }` format for studio compatibility
- [x] Note that side-effect import is NOT needed (inline pattern preferred)
- [x] Add "Best Practices" section with key guidelines

## Phase 6: CI Enhancement - Custom Questions Workflow Test

**Strategy:** Create end-to-end test of custom questions workflow:
1. Scaffold empty static course
2. Start studio mode
3. Create card using custom DataShape via Cypress
4. Verify card renders in studio browse view
5. Flush to static via Cypress button click
6. Start dev mode
7. Verify card renders in dev study view

**Key Decisions:**
- Leave existing `scaffolded-app.cy.js` alone (tests packed courses)
- New script: `try:init:empty` (no --import-course-data)
- **TWO Cypress test files** (studio tests, then dev tests - cleaner CI workflow)
- Clean up between existing and new test
- Studio mode manages its own CouchDB (no conflicts)
- Flush via Cypress clicking studio UI button

### 6.1 CLI Script - Empty Project Init
- [x] Add to `packages/cli/package.json`:
  - `try:init:empty` - scaffolds empty project with template custom questions
  - Includes npm install and file:.. dependencies

### 6.2 Cypress Tests - Custom Questions Workflow
- [x] Create `packages/cli/cypress/e2e/custom-questions-studio.cy.js`
  - Test 1: Studio UI loads
  - Test 2: Custom DataShapes appear in CreateCardView
  - Test 3: Create card with SimpleTextQuestion
  - Test 4: Card renders in studio browse view
  - Test 5: Flush to static button works
- [x] Create `packages/cli/cypress/e2e/custom-questions-dev.cy.js`
  - Test 1: Dev mode loads
  - Test 2: Flushed card renders in study view
  - Test 3: Can interact with custom question

### 6.3 CI Workflow Updates
- [x] Update `.github/workflows/ci-pkg-cli.yml`
- [x] Add after existing test cleanup:
  - Create empty project
  - Start studio mode (wait on 7174)
  - Run studio tests
  - Shutdown studio
  - Start dev mode (wait on 6173)
  - Run dev tests
  - Final cleanup (all ports)

### 6.4 Package Scripts
- [x] Update existing scripts to be specific:
  - `test:e2e` - now targets only `scaffolded-app.cy.js`
  - `test:e2e:headless` - now targets only `scaffolded-app.cy.js`
- [x] Add new custom questions scripts:
  - `test:e2e:custom:studio` - open studio tests
  - `test:e2e:custom:studio:headless` - run studio tests
  - `test:e2e:custom:dev` - open dev tests
  - `test:e2e:custom:dev:headless` - run dev tests

### 6.5 Local Testing (DEFERRED)
- [ ] Build CLI: `yarn workspace @vue-skuilder/cli build`
- [ ] Run empty init: `cd packages/cli && yarn try:init:empty`
- [ ] Test studio: `cd testproject-empty && npx skuilder studio`
- [ ] Manually verify custom questions appear in CreateCardView
- [ ] Run Cypress studio tests: `cd packages/cli && yarn test:e2e:custom:studio`
- [ ] After flush, run dev tests: `yarn test:e2e:custom:dev`

## Phase 7: Obsolete (Merged into Phase 6)

Studio mode tests are now fully covered in Phase 6 with the two-file Cypress approach:
- `custom-questions-studio.cy.js` tests studio mode functionality
- `custom-questions-dev.cy.js` tests dev mode after flush
- CI workflow runs both sequentially with proper server lifecycle management

## Phase 8: Final Verification

### 8.1 Manual Testing
- [ ] Test standalone-ui dev mode: `yarn workspace @vue-skuilder/standalone-ui dev`
- [ ] Navigate to /study and verify cards render
- [ ] Test sk-contributor dev mode (if applicable)
- [ ] From testproject: Run `npx skuilder studio`
- [ ] Verify studio loads
- [ ] Check CreateCardView for custom question types

### 8.2 Build Verification
- [ ] Run full monorepo build: `yarn build`
- [ ] Verify no errors
- [ ] Check both library outputs exist:
  - `packages/standalone-ui/dist-lib/questions.mjs`
  - `packages/sk-contributor/dist-lib/questions.mjs`

### 8.3 CI Verification
- [ ] Push branch
- [ ] Monitor CI run for `ci-pkg-cli.yml`
- [ ] Check all tests pass
- [ ] Review any failures and iterate

### 8.4 Documentation
- [ ] Create summary of changes in `agent/a.4.completion.md`
- [ ] Note any deviations from plan
- [ ] List any discovered issues or future work
- [ ] Update BACKPORT_CHECKLIST.md status if needed

## Notes

- **Phase 7 (Studio CI)** is marked optional - can be deferred to separate PR if complex
- Test locally before pushing to CI
- Keep commits atomic per phase for easier rollback
- Monitor console output for warnings about missing view names
- If studio tests prove too complex, document as future work
