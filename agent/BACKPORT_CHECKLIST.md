# Backport Checklist for Scaffolding Templates

Changes tested in `/flutor` that need to be propagated to vue-skuilder template packages.

**Note:** This document is self-contained. All necessary code examples and rationale are included below.

## How to Use This Document

1. **Copy this file** to the vue-skuilder monorepo for reference
2. **Apply changes 1-6** to the template packages (standalone-ui, sk-contributor)
3. **Test** using the testing checklist at the bottom
4. **Ignore** the "Infrastructure Changes" section - those are already in the monorepo

**Files to Update:**
- `/packages/standalone-ui/vite.config.ts`
- `/packages/standalone-ui/src/questions/index.ts`
- `/packages/standalone-ui/src/main.ts`
- `/packages/standalone-ui/src/questions/*QuestionView.vue` (all view components)
- `/packages/sk-contributor/` (same files as above)
- `/packages/standalone-ui/src/questions/README.md` (examples)

## Context

These fixes enable custom questions to work in both:
- **Standalone mode** (`yarn dev`) - already worked
- **Studio mode** (`yarn studio`) - now works after these fixes

The root cause was a combination of:
1. Browser unable to resolve bare imports in dynamically loaded modules
2. Missing view component names for runtime lookup
3. Side-effect import not running (views array staying empty)
4. Incorrect views export format for studio-ui consumption

## 1. Vite Config - External Dependencies & Terser
**File:** `vite.config.ts`
**Location:** Library build configuration
**Change:**
```typescript
build: buildMode === 'library'
  ? {
      // ...
      terserOptions: {
        keep_classnames: true,
        keep_fnames: true, // ADD: Preserve function names
        mangle: {
          properties: false, // ADD: Don't mangle static properties like seedData
        },
      },
      rollupOptions: {
        // CRITICAL: Do NOT externalize dependencies for studio mode
        // Browser cannot resolve bare imports without import maps
        external: [
          // Leave empty - bundle everything for browser compatibility
        ],
      }
    }
```
**Why:**
- Terser options prevent minification from mangling static properties (seedData, views, dataShapes)
- Empty externals array bundles all dependencies so browser can load the module without import maps
- Previously tried externalizing to avoid duplication, but browser can't resolve `import { X } from "@vue-skuilder/courseware"` at runtime
**Affects:**
- `/packages/standalone-ui/vite.config.ts`
- CLI template generation for new projects

---

## 2. Question Index - Views Export Format
**File:** `src/questions/index.ts`
**Location:** `allCustomQuestions()` function
**Change:**
```typescript
// OLD (broken):
const views: ViewComponent[] = [];
questionClasses.forEach((questionClass) => {
  if (questionClass.views) {
    questionClass.views.forEach((view) => {
      views.push(view);
    });
  }
});

// NEW (working):
const views: Array<{ name: string; component: ViewComponent }> = [];
questionClasses.forEach((questionClass) => {
  if (questionClass.views) {
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
  }
});
```
**Why:** Studio-ui expects `{ name, component }` format (see studio-ui/src/main.ts:183-189)
**Affects:**
- `/packages/standalone-ui/src/questions/index.ts`
- `/packages/sk-contributor/src/questions/index.ts`

---

## 3. Question Index - TypeScript Interface
**File:** `src/questions/index.ts`
**Location:** `CustomQuestionsExport` interface
**Change:**
```typescript
export interface CustomQuestionsExport {
  courses: CourseWare[];
  questionClasses: Array<typeof Question>;
  dataShapes: DataShape[];
  views: Array<{ name: string; component: ViewComponent }>; // CHANGED from ViewComponent[]
  inlineComponents: Record<string, any>;
  meta: { /* ... */ };
}
```
**Why:** Matches runtime format
**Affects:**
- `/packages/standalone-ui/src/questions/index.ts`
- `/packages/sk-contributor/src/questions/index.ts`

---

## 4. Main.ts - Import Questions Index
**File:** `src/main.ts`
**Location:** Before `allCourseWare.courses.push(exampleCourse)`
**Change:**
```typescript
// Import allCourseWare singleton and exampleCourse
import { allCourseWare } from '@vue-skuilder/courseware';
// Import from index.ts to ensure view setup code runs
import './questions/index'; // ADD THIS LINE
import { exampleCourse } from './questions/exampleCourse';
```
**Why:** Ensures static view setup runs before course registration
**Affects:**
- `/packages/standalone-ui/src/main.ts`
- `/packages/sk-contributor/src/main.ts`

---

## 5. Question Class - Direct Inline Views
**File:** `src/questions/MyQuestion.ts`
**Location:** Question class static properties
**Change:**
```typescript
// Import at top
import { markRaw } from 'vue';
import MyQuestionView from './MyQuestionView.vue';

export class MyQuestion extends Question {
  public static dataShapes = [/* ... */];

  // Direct inline registration - no external setup needed
  public static views = [markRaw(MyQuestionView)]; // CHANGED from empty array

  // ...
}
```
**Why:** Self-contained, works immediately, no fragile side-effects
**Affects:**
- Template examples in `/packages/standalone-ui/src/questions/README.md`
- Template examples in `/packages/sk-contributor/src/questions/README.md`
- Existing template questions (NumberRangeQuestion, etc.)

---

## 6. Vue Component - DefineOptions Name
**File:** `src/questions/MyQuestionView.vue`
**Location:** Script setup
**Change:**
```typescript
<script setup lang="ts">
import { defineOptions } from 'vue'; // ADD import

defineOptions({
  name: 'MyQuestionView' // ADD this block
});

// rest of setup...
```
**Why:** Vue components need explicit names for runtime lookup
**Affects:**
- All template Vue view components
- README examples

---

## 7. Remove Index.ts Side-Effects (Future)
**File:** `src/questions/index.ts`
**Location:** Top-level code
**Change:**
```typescript
// REMOVE these lines (views should be set in question files directly):
// import SustainedNoteQuestionView from './SustainedNoteQuestionView.vue';
// SustainedNoteQuestion.views = [markRaw(SustainedNoteQuestionView)];
```
**Why:** Side-effects are fragile; prefer direct inline registration
**Status:** Deferred until all templates use Pattern 1
**Affects:**
- `/packages/standalone-ui/src/questions/index.ts`

---

## Implementation Priority

### Phase 1 (Critical - Breaks studio mode)
- [ ] #2: Fix views export format in index.ts
- [ ] #3: Update TypeScript interface
- [ ] #1: Add terser options to vite.config

### Phase 2 (Important - Breaks runtime)
- [ ] #4: Add index.ts import to main.ts
- [ ] #6: Add defineOptions to all template Vue components

### Phase 3 (Nice to have)
- [ ] #5: Update documentation/examples to show direct inline pattern
- [ ] #7: Remove side-effects from index.ts (future)

## Testing Checklist

After backporting, verify:
- [ ] `yarn dev` works (standalone mode)
- [ ] `yarn studio` works (studio mode)
- [ ] Custom questions appear in studio CreateCardView
- [ ] Card creation works with custom DataShapes
- [ ] Seed data registration doesn't error
- [ ] Cards render correctly in both modes
- [ ] Custom inline markdown components work

## Infrastructure Changes (Already Done in Monorepo)

**⚠️ You do NOT need to apply these changes - they are already in the monorepo codebase.**

These were supporting infrastructure fixes made alongside the template changes:

### CLI - studio.ts
**File:** `/packages/cli/src/commands/studio.ts`
**What changed:** Config import path updated when copying to dist
```typescript
// Line ~1147
configContent.importPath = '/assets/questions.mjs'; // Absolute path from root
```
**Why:** Ensures browser can find the bundled questions module

### Studio-UI - main.ts
**File:** `/packages/studio-ui/src/main.ts`
**What changed:**
- Registers custom courses with `allCourseWare.courses.push(...customQuestions.courses)`
- Added verbose debug logging for troubleshooting
- Uses `/* @vite-ignore */` comment for dynamic import

**Why:** Studio-ui now properly integrates custom courses into the singleton

---

## Related Files

**Templates:**
- `/packages/standalone-ui/src/questions/`
- `/packages/sk-contributor/src/questions/`

**CLI Generation:**
- `/packages/cli/src/utils/template.ts` (may need updates)
- `/packages/cli/src/commands/scaffold.ts`

**Documentation:**
- `/packages/standalone-ui/src/questions/README.md`
- Main docs site (if applicable)
