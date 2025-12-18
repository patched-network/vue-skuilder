# DONE: Add `register-questions` CLI Command to vue-skuilder

**Status:** Implementation complete. Manual testing deferred to user.

---

## Context

**Problem:** Standalone Skuilder apps (like LettersPractice, Flutor) define custom question types with DataShapes. These DataShapes need to be registered in the CourseConfig document in CouchDB for the course to function properly.

Currently, `studio-ui` does this registration on every startup (see `packages/studio-ui/src/main.ts` lines 120-177), which is fine for local dev tooling. But standalone production apps should NOT write to CourseConfig on every page load.

**Solution:** Provide a CLI command that standalone app developers can run once (or as needed) to register their question types with the remote CouchDB.

**Workflow for standalone app authors:**
```bash
# In their standalone app directory (e.g., letterspractice/)
yarn build:lib                              # Compile question types to dist-lib/
npx @vue-skuilder/cli register-questions    # Write DataShapes to CourseConfig in CouchDB
```

---

## Implementation Steps

### 1. Move registration utilities to `@vue-skuilder/db`

**Source:** `packages/studio-ui/src/utils/courseConfigRegistration.ts`
**Destination:** `packages/db/src/courseConfigRegistration.ts`

**Refactoring needed:**
- Remove dependency on `getCurrentUser()` from `@vue-skuilder/common-ui`
- Instead, pass `username: string` as a parameter to `registerSeedData()`
- Keep all other logic intact

**Export from package:**
- Add export to `packages/db/src/index.ts`:
  ```typescript
  export * from './courseConfigRegistration';
  ```

### 2. Update `studio-ui` imports

**File:** `packages/studio-ui/src/main.ts`

Change:
```typescript
import { registerCustomQuestionTypes } from './utils/courseConfigRegistration';
```
To:
```typescript
import { registerCustomQuestionTypes } from '@vue-skuilder/db';
```

Delete: `packages/studio-ui/src/utils/courseConfigRegistration.ts`

### 3. Add `register-questions` command to CLI

**New file:** `packages/cli/src/commands/register-questions.ts`

The command should:

1. **Read config:** Load `skuilder.config.json` from CWD for:
   - `course` (course ID)
   - `dataLayerType` (should be "couch" for this to work)
   - CouchDB connection info (may need to add fields or read from env)

2. **Import built library:** Dynamically import `./dist-lib/questions.mjs` from CWD
   - Call `allCustomQuestions()` to get the question types

3. **Connect to CouchDB:** Initialize data layer with couch config

4. **Register:** Call the registration utilities from `@vue-skuilder/db`:
   - `processCustomQuestionsData()`
   - `registerDataShape()` for each DataShape
   - `registerQuestionType()` for each question type
   - `courseDB.updateCourseConfig()`

5. **Report results:** Log what was registered/updated

**Add to CLI command registry:** Update `packages/cli/src/index.ts` to include the new command.

### 4. Config additions for CouchDB connection

Standalone apps need to specify their CouchDB connection for the CLI. Options:

**Option A:** Add to `skuilder.config.json`:
```json
{
  "course": "letterspractice",
  "dataLayerType": "couch",
  "couchdb": {
    "url": "https://letterspractice.com/couch",
    "username": "admin",
    "password": "..."
  }
}
```
(Password could be env var reference like `"$COUCH_PASSWORD"`)

**Option B:** CLI flags:
```bash
npx @vue-skuilder/cli register-questions --couch-url https://letterspractice.com/couch --user admin
```
(Password prompted or from env)

**Recommendation:** Option A with env var support for password, since the URL is stable config.

>>> USER INPUT: I prefer a bit of both here - read what's listed in the skuilder.config.json, but also take --user and --password cli flags. I'm a little wary of storing credentials in this config. NB that transport must be secure.

---

## Files to modify in vue-skuilder repo

1. `packages/db/src/courseConfigRegistration.ts` - NEW (moved from studio-ui)
2. `packages/db/src/index.ts` - Add export
3. `packages/studio-ui/src/main.ts` - Update import
4. `packages/studio-ui/src/utils/courseConfigRegistration.ts` - DELETE
5. `packages/cli/src/commands/register-questions.ts` - NEW
6. `packages/cli/src/index.ts` - Register command



>>> USER INPUT: defer this. User will drive manual testing later.
4. Test in letterspractice:
   ```bash
   yarn build:lib
   npx @vue-skuilder/cli register-questions --help
   # Then with real CouchDB connection
   ```

---

## Reference: Current registration utility functions

From `studio-ui/src/utils/courseConfigRegistration.ts`:

- `processCustomQuestionsData(customQuestions)` - Transforms allCustomQuestions() output
- `registerDataShape(dataShape, courseConfig)` - Adds DataShape to CourseConfig
- `registerQuestionType(question, courseConfig)` - Adds QuestionType to CourseConfig
- `registerSeedData(question, courseDB)` - Writes seed data docs (needs username refactor)
- `registerCustomQuestionTypes(customQuestions, courseConfig, courseDB)` - Main orchestrator
- `registerBlanksCard(...)` - Special case for built-in BlanksCard type

---

## Notes

- The CLI already has patterns for reading `skuilder.config.json` - see existing commands
- LettersPractice's `allCustomQuestions()` is in `src/questions/index.ts` and exports to `dist-lib/`
- The registration is idempotent - running multiple times updates rather than duplicates

---

## Docs

Update ./docs/cli.md reference doc with the new method


---

## Testing

Save for last. builds are expensive on this machine, and can intterupt flow.

1. Run `yarn build` in `packages/db` - should compile without errors
2. Run `yarn build` in `packages/studio-ui` - should work with new import
3. Run `yarn build` in `packages/cli` - should include new command

---

## Implementation Summary

**Completed 2024-12-18**

### Changes Made

1. **`packages/db/src/courseConfigRegistration.ts`** - NEW
   - Moved from studio-ui with refactoring
   - `registerSeedData()` now takes `username: string` parameter
   - Uses `@vue-skuilder/db` logger instead of console.log
   - Removed dependency on `@vue-skuilder/common-ui`

2. **`packages/db/src/index.ts`** - MODIFIED
   - Added `export * from './courseConfigRegistration'`

3. **`packages/studio-ui/src/main.ts`** - MODIFIED
   - Updated imports to use `@vue-skuilder/db` instead of local utils

4. **`packages/studio-ui/src/utils/courseConfigRegistration.ts`** - DELETED

5. **`packages/cli/src/commands/register-questions.ts`** - NEW
   - Reads `course` and `couchdbUrl` from `skuilder.config.json`
   - Requires `--user` and `--password` CLI flags
   - Supports `--dry-run` for previewing changes
   - Supports custom `--config` and `--questions` paths

6. **`packages/cli/src/cli.ts`** - MODIFIED
   - Added import and registration for new command

7. **`docs/cli.md`** - MODIFIED
   - Added documentation for `register-questions` command

### Usage

```bash
# In standalone app directory after yarn build:lib
npx @vue-skuilder/cli register-questions --user admin --password secret

# Preview changes
npx @vue-skuilder/cli register-questions --dry-run --user admin --password secret
```
