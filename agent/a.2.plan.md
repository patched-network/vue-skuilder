# Plan: Backport Custom Questions Fixes with CI Verification

## Objective

Apply all custom questions fixes from the flutor testing to the monorepo templates, and add CI tests to prevent regression.

## Success Criteria

1. ✅ All 6 backport changes applied to both `standalone-ui` and `sk-contributor`
2. ✅ Library builds succeed with correct output structure
3. ✅ Standalone mode works (existing test already covers this)
4. ✅ Studio mode works (new test to verify)
5. ✅ CI catches breakage if any of these changes regress

## Scope

### In Scope
- All changes from BACKPORT_CHECKLIST phases 1-3
- Both template packages: standalone-ui and sk-contributor
- CI enhancements to test custom questions
- Studio mode verification test

### Out of Scope
- Changes to infrastructure packages (already done per checklist)
- Platform-ui changes (not a scaffolding template)
- Breaking API changes to Question class

## Implementation Phases

### Phase 1: Backport Critical Changes (Both Packages)

**Files to modify:**
- `packages/standalone-ui/vite.config.ts`
- `packages/sk-contributor/vite.config.ts`
- `packages/standalone-ui/src/questions/index.ts`
- `packages/sk-contributor/src/questions/index.ts`

**Changes:**

1. **Vite config terser options** (BACKPORT #1)
   ```typescript
   terserOptions: {
     keep_classnames: true,
     keep_fnames: true,              // ADD
     mangle: {
       properties: false,            // ADD
     },
   }
   ```

2. **Views export format** (BACKPORT #2)
   ```typescript
   // Change from:
   const views: ViewComponent[] = [];

   // To:
   const views: Array<{ name: string; component: ViewComponent }> = [];

   // With name extraction logic:
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

3. **TypeScript interface** (BACKPORT #3)
   ```typescript
   export interface CustomQuestionsExport {
     // ... other fields
     views: Array<{ name: string; component: ViewComponent }>;  // CHANGE
   }
   ```

### Phase 2: Add Component Names (Both Packages)

**Files to modify:**
- `packages/standalone-ui/src/questions/SimpleTextQuestionView.vue`
- `packages/standalone-ui/src/questions/MultipleChoiceQuestionView.vue`
- `packages/standalone-ui/src/questions/NumberRangeQuestionView.vue`
- `packages/sk-contributor/src/questions/SimpleTextQuestionView.vue`
- `packages/sk-contributor/src/questions/MultipleChoiceQuestionView.vue`
- `packages/sk-contributor/src/questions/NumberRangeQuestionView.vue`

**Changes:** (BACKPORT #6)
```vue
<script setup lang="ts">
import { defineOptions } from 'vue';  // ADD if not present

defineOptions({
  name: 'SimpleTextQuestionView'  // ADD - use appropriate name for each
});

// rest of setup...
```

### Phase 3: Add Side-Effect Import (Both Packages)

**Files to modify:**
- `packages/standalone-ui/src/main.ts`
- `packages/sk-contributor/src/main.ts`

**Changes:** (BACKPORT #4)
```typescript
// Import allCourseWare singleton and exampleCourse
import { allCourseWare } from '@vue-skuilder/courseware';
import './questions/index';  // ADD THIS LINE
import { exampleCourse } from './questions/exampleCourse';
```

**Rationale:** Even though question classes have inline views, this ensures the index.ts module runs and all exports are properly initialized before course registration.

### Phase 4: Update Documentation

**Files to modify:**
- `packages/standalone-ui/src/questions/README.md`
- `packages/sk-contributor/src/questions/README.md` (if exists)

**Changes:** (BACKPORT #5)
Update examples to show:
- Direct inline view registration pattern
- Use of `markRaw()` for Vue components
- Use of `defineOptions({ name: '...' })` in Vue components
- Correct `{ name, component }` format in static views

### Phase 5: Build and Verify

**Steps:**
1. Build standalone-ui library mode
   ```bash
   BUILD_MODE=library yarn workspace @vue-skuilder/standalone-ui build
   ```

2. Verify output in `packages/standalone-ui/dist-lib/`:
   - `questions.mjs` exists
   - Static properties not mangled (inspect with `less questions.mjs`)
   - Views array has correct structure

3. Build sk-contributor library mode
   ```bash
   BUILD_MODE=library yarn workspace @vue-skuilder/sk-contributor build
   ```

4. Verify output in `packages/sk-contributor/dist-lib/`

5. Test standalone dev mode
   ```bash
   yarn workspace @vue-skuilder/standalone-ui dev
   # Navigate to /study and verify cards render
   ```

## CI Enhancement Plan

### Current State
- `ci-pkg-cli.yml` tests scaffolded apps
- Runs `yarn try:init` to create test project
- Runs basic smoke test (home page loads, study view renders cards)

### Proposed Enhancements

#### 1. Enhanced Scaffolded App Test

**Extend:** `packages/cli/cypress/e2e/scaffolded-app.cy.js`

**Add tests for:**
```javascript
describe('Custom Questions - Standalone Mode', () => {
  it('should render custom question types in study view', () => {
    cy.visit('/study');

    // Verify SimpleTextQuestionView renders
    // (component should have data-viewable="SimpleTextQuestionView")
    cy.get('[data-viewable*="SimpleTextQuestionView"]', { timeout: 15000 })
      .should('exist');

    // Verify question has input field
    cy.get('input[placeholder*="answer"], input[type="text"]')
      .should('be.visible');
  });

  it('should have custom data shapes in example course', () => {
    // This verifies that dataShapes are properly exported
    // Could check via dev tools or API if exposed
  });
});
```

#### 2. Studio Mode Test (New)

**New file:** `packages/cli/cypress/e2e/scaffolded-app-studio.cy.js`

**Test studio mode integration:**
```javascript
describe('Custom Questions - Studio Mode', () => {
  before(() => {
    // Start studio mode server
    // This may require adding a studio start script to testproject
  });

  it('should load studio UI with custom questions', () => {
    cy.visit('http://localhost:6174'); // or wherever studio runs

    // Verify studio UI loads
    cy.get('body').should('be.visible');
  });

  it('should show custom data shapes in CreateCardView', () => {
    cy.visit('http://localhost:6174/create');

    // Verify custom DataShapes appear in dropdown/selector
    cy.contains('SimpleTextQuestion').should('exist');
    cy.contains('MultipleChoiceQuestion').should('exist');
    cy.contains('NumberRangeQuestion').should('exist');
  });

  it('should render custom views when creating card', () => {
    cy.visit('http://localhost:6174/create');

    // Select custom question type
    cy.contains('SimpleTextQuestion').click();

    // Verify view component loads (may need to fill required fields first)
    // Check for component-specific elements
  });
});
```

#### 3. CI Workflow Enhancement

**Modify:** `.github/workflows/ci-pkg-cli.yml`

**Add studio mode test step:**
```yaml
- name: Start studio mode and wait
  working-directory: packages/cli/testproject
  run: |
    # Start studio server in background
    npm run studio &
    # Wait for studio to be ready
    npx wait-on http://localhost:6174 --timeout 60000

- name: Run E2E tests on studio mode
  working-directory: packages/cli
  run: yarn test:e2e:studio:headless

- name: Cleanup services
  if: always()
  run: |
    kill $(lsof -t -i:5173) || true
    kill $(lsof -t -i:6174) || true  # ADD studio port
    yarn couchdb:stop
```

**Add to cleanup step:**
```yaml
- name: Cleanup services
  if: always()
  run: |
    # Clean up dev server
    kill $(lsof -t -i:5173) || true
    # Clean up studio server
    kill $(lsof -t -i:6174) || true
    # Clean up CouchDB
    yarn couchdb:stop
```

#### 4. Package Scripts

**Add to:** `packages/cli/package.json`
```json
{
  "scripts": {
    "test:e2e:studio": "cypress open --config-file cypress.studio.config.js",
    "test:e2e:studio:headless": "cypress run --config-file cypress.studio.config.js"
  }
}
```

**Create:** `packages/cli/cypress.studio.config.js`
```javascript
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:6174',
    specPattern: 'cypress/e2e/*-studio.cy.js',
    supportFile: 'cypress/support/e2e.js',
  },
});
```

## Verification Checklist

After completing all phases:

**Manual Verification:**
- [ ] `yarn dev` works (standalone mode) - both packages
- [ ] `yarn studio` works (studio mode) - both packages
- [ ] Custom questions appear in studio CreateCardView
- [ ] Card creation works with custom DataShapes
- [ ] Seed data registration doesn't error
- [ ] Cards render correctly in both modes
- [ ] Custom inline markdown components work (if applicable)

**Build Verification:**
- [ ] Library build completes without errors
- [ ] Output has `questions.mjs` with correct structure
- [ ] Static properties preserved (not mangled)
- [ ] Views array has `{ name, component }` format

**CI Verification:**
- [ ] All existing CI tests pass
- [ ] New custom questions tests pass
- [ ] Studio mode tests pass (if added)
- [ ] No console errors in test runs

## Risks and Mitigations

### Risk: Studio mode test complexity
Studio mode may require more complex setup (database, auth, etc.)

**Mitigation:**
- Start with basic "does it load" test
- Gradually add more specific tests
- Document studio setup requirements

### Risk: CI instability with multiple servers
Running dev + studio + couchdb may cause port conflicts or timing issues

**Mitigation:**
- Use explicit port assignments
- Add robust wait-on checks
- Ensure cleanup runs even on failure
- Consider separate CI jobs for studio tests

### Risk: Breaking changes to question API
Changes to views format might break existing user code

**Mitigation:**
- These are template packages, not library code
- Changes only affect scaffolded projects going forward
- Document migration path in README
- Consider adding migration guide to docs site

### Risk: Test maintenance burden
More tests = more maintenance

**Mitigation:**
- Keep tests focused on critical paths
- Use test selectors that are stable
- Document test rationale in comments
- Review test failures promptly

## Timeline Estimate

- **Phase 1-3 (Backport):** 1-2 hours
- **Phase 4 (Documentation):** 30 minutes
- **Phase 5 (Build verification):** 30 minutes
- **CI Enhancement:** 2-3 hours
  - Writing tests: 1-2 hours
  - CI setup: 1 hour
  - Debugging: variable

**Total:** 4-6 hours

## Next Steps

1. Get approval on this plan
2. Create detailed todo checklist
3. Start with Phase 1 on standalone-ui
4. Verify each phase before moving to next
5. Replicate to sk-contributor
6. Add CI enhancements
7. Document any deviations or learnings
