# Todo: Backport Custom Questions Fixes with CI Verification

## Phase 1: Backport Critical Changes to standalone-ui

### 1.1 Vite Config - Terser Options
- [x] Open `packages/standalone-ui/vite.config.ts`
- [x] Locate `terserOptions` in library build config (around line 48-50)
- [x] Add `keep_fnames: true`
- [x] Add `mangle: { properties: false }`
- [x] Verify syntax is correct

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
- [ ] Open `packages/standalone-ui/src/questions/README.md`
- [ ] Update examples to show `defineOptions({ name: '...' })` pattern
- [ ] Update examples to show direct inline view registration
- [ ] Add note about `markRaw()` for Vue components
- [ ] Add note about `{ name, component }` format
- [ ] Note that side-effect import is NOT needed (inline pattern preferred)

## Phase 6: CI Enhancement - Standalone Mode Tests

### 6.1 Enhanced Scaffolded App Test
- [ ] Open `packages/cli/cypress/e2e/scaffolded-app.cy.js`
- [ ] Add new describe block: 'Custom Questions - Standalone Mode'
- [ ] Add test: 'should render custom question types in study view'
  - Check for `[data-viewable*="SimpleTextQuestionView"]`
  - Check for input elements
- [ ] Add test: 'should display all three question types'
  - Verify SimpleText, MultipleChoice, NumberRange can appear
- [ ] Run local test to verify: `cd packages/cli && yarn test:e2e:headless`

### 6.2 Verify Existing CI Passes
- [ ] Check CI workflow will trigger on these changes
- [ ] Ensure `ci-pkg-cli.yml` includes relevant paths
- [ ] Plan to monitor CI after push

## Phase 7: CI Enhancement - Studio Mode Tests (Optional/Future)

### 7.1 Studio Mode Test File
- [ ] Create `packages/cli/cypress/e2e/scaffolded-app-studio.cy.js`
- [ ] Add test: 'should load studio UI'
  - Visit studio port (7174)
  - Check for page load
- [ ] Add test: 'should show custom data shapes in CreateCardView'
  - Look for SimpleTextQuestion, MultipleChoiceQuestion, NumberRangeQuestion

### 7.2 Cypress Config for Studio
- [ ] Create `packages/cli/cypress.studio.config.js`
- [ ] Configure baseUrl: 'http://localhost:7174'
- [ ] Configure specPattern for `-studio.cy.js` files

### 7.3 Package Scripts
- [ ] Add to `packages/cli/package.json`:
  - `"test:e2e:studio": "cypress open --config-file cypress.studio.config.js"`
  - `"test:e2e:studio:headless": "cypress run --config-file cypress.studio.config.js"`

### 7.4 CI Workflow Addition
- [ ] Open `.github/workflows/ci-pkg-cli.yml`
- [ ] Add step after "Run try:init":
  ```yaml
  - name: Start studio mode and wait
    working-directory: packages/cli/testproject
    run: |
      npx skuilder studio --no-browser &
      npx wait-on http://localhost:7174 --timeout 120000
  ```
- [ ] Add step for studio tests:
  ```yaml
  - name: Run E2E tests on studio mode
    working-directory: packages/cli
    run: yarn test:e2e:studio:headless
  ```
- [ ] Update cleanup step to kill studio ports:
  ```yaml
  kill $(lsof -t -i:7174) || true
  kill $(lsof -t -i:3001) || true
  kill $(lsof -t -i:5985) || true
  ```

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
