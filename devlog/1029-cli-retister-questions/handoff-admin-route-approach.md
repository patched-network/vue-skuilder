# Handoff: register-questions - Pivot to Admin Route Approach

**Date:** 2024-12-19
**Context:** CLI `register-questions` command hit fundamental Node.js vs browser incompatibilities

---

## What Went Wrong with CLI Approach

### The Goal
Create a CLI command (`skuilder register-questions`) that standalone app developers could run to register their custom question types (DataShapes) with a remote CouchDB, avoiding the need to register on every page load.

### Implementation Completed
1. Moved `courseConfigRegistration.ts` from `studio-ui` to `@vue-skuilder/db`
2. Refactored `registerSeedData()` to accept `username` param instead of calling `getCurrentUser()`
3. Created `packages/cli/src/commands/register-questions.ts`
4. Added command to CLI, updated docs

### Where It Failed
The command needed to dynamically import the standalone app's built `dist-lib/questions.mjs` module. This module is built by Vite for **browser consumption**, and running it in Node.js hit a cascade of incompatibilities:

| Issue | Attempted Fix | Result |
|-------|--------------|--------|
| `self is not defined` | Polyfill `globalThis.self = globalThis` | Fixed |
| `Invalid Adapter: undefined` (PouchDB) | Initialize data layer before import | Fixed |
| `gr is not a function` (Paper.js) | Externalize `@vue-skuilder/courseware` in build | Moved problem to npm-published package |
| Same Paper.js error from npm package | Try to mock `gr` globally | Didn't work (local scope) |
| CSS imports failing | Register Node.js module loader hook | Fixed |
| Module resolution for externalized packages | Use `link:` deps to workspace packages | Now can't find packages at runtime |

**Root cause:** The questions library bundles browser-specific code (Paper.js, PouchDB with browser adapters, CSS imports, Vue components). Making this run in Node.js requires either:
- Completely different build configuration for Node.js target
- Extensive mocking/polyfilling of browser APIs
- Neither is maintainable long-term

---

## Alternative: Admin Route in Standalone App

### Concept
Instead of a CLI command running in Node.js, add a protected admin route to the standalone app itself. This runs in the browser where all the bundling works correctly.

### Implementation Sketch

**Route:** `/admin/register-questions`

**Protection:**
- Check user is authenticated and has admin privileges
- Could use existing auth from `@vue-skuilder/common-ui`

**UI:**
```
┌─────────────────────────────────────────────────────┐
│ Register Question Types                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Current CourseConfig:                               │
│   • 3 DataShapes registered                         │
│   • 2 QuestionTypes registered                      │
│                                                     │
│ From allCustomQuestions():                          │
│   • 5 DataShapes found                              │
│   • 4 QuestionTypes found                           │
│                                                     │
│ Changes to apply: (eg)                              │
│   + Add DataShape: letterspractice.Spelling         │
│   + Add QuestionType: SpelingView                   │
│                                                     │
│           [ Register Question Types ]               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Logic:**
```typescript
// In the admin route component
import { allCustomQuestions } from '@/questions';
import {
  registerCustomQuestionTypes,
  processCustomQuestionsData
} from '@vue-skuilder/db';

// Load current state
const courseDB = getDataLayer().getCourseDB(courseId);
const courseConfig = await courseDB.getCourseConfig();
const customQuestions = allCustomQuestions();

// Preview changes
const { dataShapes, questions } = processCustomQuestionsData(customQuestions);
// Show diff in UI...

// On button click
const result = await registerCustomQuestionTypes(
  customQuestions,
  courseConfig,
  courseDB,
  currentUser.username
);
```

### Advantages
1. **Runs in browser** - all bundling/imports work correctly
2. **Uses existing code** - `registerCustomQuestionTypes` from `@vue-skuilder/db`
3. **Visual feedback** - can show diff, confirmation, results
4. **No build complexity** - no special Node.js build config needed
5. **Auth built-in** - uses app's existing auth system

---

## Could Studio Mode Work Against Production CouchDB?

### The Question
Could a developer run the existing `skuilder studio` locally and point it at the production CouchDB at `letterspractice.com/couch`?

### Likely Issues

**1. CORS (Cross-Origin Resource Sharing)**
- Studio UI runs on `localhost:7174`
- Production CouchDB is at `letterspractice.com/couch`
- Browser will block cross-origin requests unless CouchDB has CORS configured to allow `localhost`
- Production CouchDB likely only allows `letterspractice.com` origin

**2. Authentication**
- Studio mode creates a temporary Docker CouchDB with known credentials
- Production CouchDB has different auth
- Would need to pass production credentials somehow

**3. Database Naming**
- Studio mode generates unique database names like `studio-letterspractice-1234567890`
- Would need to target the actual production database name

**4. Risk**
- Running studio against production is risky (potential data corruption)
- No isolation between dev and prod

### Verdict
Running studio locally against production CouchDB would require:
1. CORS configuration on production CouchDB (security concern)
2. Modified studio mode to accept remote CouchDB URL and credentials
3. Careful handling to prevent accidental production changes

**Not recommended** for the registration use case. The admin route approach is safer and simpler.

---

## Files Changed in CLI Attempt (for reference)

These changes are still useful for studio-ui and the admin route approach:

1. **`packages/db/src/courseConfigRegistration.ts`** - NEW, moved from studio-ui
2. **`packages/db/src/index.ts`** - exports registration utilities
3. **`packages/studio-ui/src/main.ts`** - imports from `@vue-skuilder/db`
4. **`packages/studio-ui/src/utils/courseConfigRegistration.ts`** - DELETED

CLI-specific (may want to remove or mark as WIP):
1. **`packages/cli/src/commands/register-questions.ts`** - the problematic command
2. **`packages/cli/src/cli.ts`** - registers the command
3. **`docs/cli.md`** - documents the command

---

## Next Steps

1. **Decide on CLI command fate:**
   - [x] Remove entirely? ✅ **DONE (2025-12-19)**
   - Keep as WIP with prominent warning about limitations?
   - Leave dormant for potential future Node.js-compatible build?

>>> yes - remove entirely. this node-compilation of vue component modules will never be worth maintanence headache.

**Completed:** Removed `register-questions` command, imports, and documentation from CLI package.

2. **Implement admin route in standalone-ui template:**
   - Add protected route
   - Create registration UI component
   - Wire up to existing `@vue-skuilder/db` utilities
   
>>> add also some logic either in guard or in component so that a scaffolded app in *static* mode doesn't display anything, but instead redirects people to use the studio-ui mechanisms (`yarn studio` in a scaffolded app.)

3. **Update standalone app scaffolding:**
   - Include admin route in `skuilder init` template
   - Document the workflow for registering question types
   
>>> this point seems confused - the standalone-ui package *is* the app that gets scaffolded out via skuilder init. If we add it there, there will be no further changes needed for the scaffolding.

4. **For letterspractice specifically:**
   - Add the admin route manually
   - Run once to register DataShapes
   - Remove the page-load registration code

>>> set this aside to do together w/ user after initial steps are complete.
