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

### 1.4 Test Build
- [ ] Run: `BUILD_MODE=library yarn workspace @vue-skuilder/standalone-ui build`
- [ ] Verify build succeeds
- [ ] Inspect `packages/standalone-ui/dist-lib/questions.mjs` for correct output

## Phase 2: Add Component Names to standalone-ui

### 2.1 SimpleTextQuestionView.vue
- [ ] Open `packages/standalone-ui/src/questions/SimpleTextQuestionView.vue`
- [ ] Add import if not present: `import { defineOptions } from 'vue';`
- [ ] Add after imports (before props):
  ```typescript
  defineOptions({
    name: 'SimpleTextQuestionView'
  });
  ```

### 2.2 MultipleChoiceQuestionView.vue
- [ ] Open `packages/standalone-ui/src/questions/MultipleChoiceQuestionView.vue`
- [ ] Add defineOptions import
- [ ] Add: `defineOptions({ name: 'MultipleChoiceQuestionView' });`

### 2.3 NumberRangeQuestionView.vue
- [ ] Open `packages/standalone-ui/src/questions/NumberRangeQuestionView.vue`
- [ ] Add defineOptions import
- [ ] Add: `defineOptions({ name: 'NumberRangeQuestionView' });`

### 2.4 Test Build Again
- [ ] Run: `BUILD_MODE=library yarn workspace @vue-skuilder/standalone-ui build`
- [ ] Verify build succeeds
- [ ] Check that component names are preserved in output

## Phase 3: Side-Effect Import to standalone-ui

### 3.1 Main.ts Import
- [ ] Open `packages/standalone-ui/src/main.ts`
- [ ] Locate line 27-28 (imports from courseware)
- [ ] Add line after line 27: `import './questions/index';`
- [ ] Ensure it's before: `import { exampleCourse } from './questions/exampleCourse';`

### 3.2 Test Dev Mode
- [ ] Run: `yarn workspace @vue-skuilder/standalone-ui dev`
- [ ] Navigate to http://localhost:6173
- [ ] Verify app loads without errors
- [ ] Check browser console for warnings

## Phase 4: Replicate to sk-contributor

### 4.1 Vite Config
- [ ] Open `packages/sk-contributor/vite.config.ts`
- [ ] Apply same terser options changes as 1.1
- [ ] Verify syntax

### 4.2 Views Export Format
- [ ] Open `packages/sk-contributor/src/questions/index.ts`
- [ ] Apply same changes as 1.2 (views array and logic)

### 4.3 TypeScript Interface
- [ ] Apply same changes as 1.3 to interface

### 4.4 Component Names
- [ ] Open `packages/sk-contributor/src/questions/SimpleTextQuestionView.vue`
- [ ] Add defineOptions with name (same as 2.1)
- [ ] Open `packages/sk-contributor/src/questions/MultipleChoiceQuestionView.vue`
- [ ] Add defineOptions with name (same as 2.2)
- [ ] Open `packages/sk-contributor/src/questions/NumberRangeQuestionView.vue`
- [ ] Add defineOptions with name (same as 2.3)

### 4.5 Side-Effect Import
- [ ] Open `packages/sk-contributor/src/main.ts`
- [ ] Apply same change as 3.1

### 4.6 Test Build
- [ ] Run: `BUILD_MODE=library yarn workspace @vue-skuilder/sk-contributor build`
- [ ] Verify build succeeds
- [ ] Spot check output structure

## Phase 5: Update Documentation

### 5.1 Standalone-ui README
- [ ] Open `packages/standalone-ui/src/questions/README.md`
- [ ] Update examples to show `defineOptions({ name: '...' })` pattern
- [ ] Update examples to show direct inline view registration
- [ ] Add note about `markRaw()` for Vue components
- [ ] Add note about `{ name, component }` format

### 5.2 sk-contributor README (if exists)
- [ ] Check if `packages/sk-contributor/src/questions/README.md` exists
- [ ] If yes, apply same documentation updates

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
