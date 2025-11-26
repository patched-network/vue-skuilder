# Implementation Plan: Move CustomQuestionsExport to Common Package

## Selected Approach

**Option B**: Move interface to `@vue-skuilder/common` with simplified structure based on actual usage.

## Rationale

- Establishes single source of truth in neutral shared package
- Eliminates duplicate interface definitions
- Provides proper type safety at both provider and consumer
- Includes currently-missing `inlineComponents` property
- Follows existing pattern (DataShape, ViewComponent, etc. already in common)
- No circular dependencies

## Implementation Tasks

### Phase 1: Create Interface in Common Package

**Files to modify:**
- `packages/common/src/types/customQuestions.ts` - NEW FILE
- `packages/common/src/types/index.ts` - Add export

**Implementation:**
1. Create new type definition file with `CustomQuestionsExport` interface
2. Include all currently-used properties plus missing `inlineComponents`
3. Use actual consumer types (e.g., `Displayable[]` for questionClasses)
4. Make `inlineComponents` and `meta` optional (not required by all consumers)
5. Export from common package index

**Reference locations:**
- Current interface: `packages/standalone-ui/src/questions/index.ts:103-118`
- Consumer usage: `packages/studio-ui/src/main.ts:90-235`
- Consumer redef: `packages/studio-ui/src/utils/courseConfigRegistration.ts:9-22`

### Phase 2: Update Provider (standalone-ui)

**Files to modify:**
- `packages/standalone-ui/src/questions/index.ts`

**Implementation:**
1. Remove local `CustomQuestionsExport` interface definition (lines 103-118)
2. Import `CustomQuestionsExport` from `@vue-skuilder/common`
3. Add explicit return type to `allCustomQuestions()` function
4. Add re-export for backwards compatibility: `export type { CustomQuestionsExport } from '@vue-skuilder/common';`
5. Keep default export and function implementation unchanged

**Specific changes:**
- Delete lines 100-118 (interface definition and comment)
- Add import: `import type { CustomQuestionsExport } from '@vue-skuilder/common';`
- Update line 37: `export function allCustomQuestions(): CustomQuestionsExport {`
- Add re-export for backwards compat

### Phase 3: Update Consumer Registration Utils

**Files to modify:**
- `packages/studio-ui/src/utils/courseConfigRegistration.ts`

**Implementation:**
1. Remove duplicate `CustomQuestionsData` interface (lines 9-22)
2. Import `CustomQuestionsExport` from `@vue-skuilder/common`
3. Update function signatures to use `CustomQuestionsExport`
4. Verify type compatibility with existing code

**Specific changes:**
- Delete lines 9-22 (`CustomQuestionsData` interface)
- Add import: `import type { CustomQuestionsExport } from '@vue-skuilder/common';`
- Line 94: Change `processCustomQuestionsData(data: CustomQuestionsData)` to `processCustomQuestionsData(data: CustomQuestionsExport)`
- Line 347: Change `registerCustomQuestionTypes(customQuestions: CustomQuestionsData)` to `registerCustomQuestionTypes(customQuestions: CustomQuestionsExport)`

### Phase 4: Update Consumer Main Entry

**Files to modify:**
- `packages/studio-ui/src/main.ts`

**Implementation:**
1. Import `CustomQuestionsExport` type
2. Add type annotation to `customQuestions` variable declaration
3. Verify all property accesses are valid per interface
4. Document that `inlineComponents` is optional/future

**Specific changes:**
- Add import: `import type { CustomQuestionsExport } from '@vue-skuilder/common';`
- Line 90: Change `customQuestions = customModule.allCustomQuestions?.();` to typed version
- Add type annotation at declaration point (wherever `customQuestions` is declared)
- Keep optional chaining for runtime safety

### Phase 5: Build and Verify

**Commands to run:**
1. `yarn workspace @vue-skuilder/common build` - Build common package
2. `yarn workspace @vue-skuilder/standalone-ui build` - Build provider
3. `yarn workspace @vue-skuilder/studio-ui build` - Build consumer (if exists)
4. `yarn workspace @vue-skuilder/platform-ui build` - Build platform-ui
5. Type check all affected packages

**Verification:**
- No TypeScript errors in any package
- No breaking changes to exported API surface
- Runtime behavior unchanged

## Detailed Interface Definition

```typescript
// packages/common/src/types/customQuestions.ts
import type { CourseWare } from '@vue-skuilder/courseware';
import type { DataShape, Displayable } from './index';
import type { ViewComponent } from './vue';

/**
 * Standard export structure for custom question packages.
 * Used by studio-ui to discover and register custom question types.
 */
export interface CustomQuestionsExport {
  /**
   * CourseWare instances containing question instances
   */
  courses: CourseWare[];

  /**
   * Question class constructors for registration
   */
  questionClasses: Displayable[];

  /**
   * Available data shapes for studio-ui CreateCardView
   */
  dataShapes: DataShape[];

  /**
   * Vue components for runtime registration
   * Each entry has a name (for registration) and component (Vue component)
   */
  views: Array<{
    name: string;
    component: ViewComponent;
  }>;

  /**
   * Optional inline components for markdown rendering
   * Provided to app as 'markdownComponents'
   */
  inlineComponents?: Record<string, ViewComponent>;

  /**
   * Optional metadata for debugging and analysis
   */
  meta?: {
    questionCount?: number;
    dataShapeCount?: number;
    viewCount?: number;
    courseCount?: number;
    packageName?: string;
    sourceDirectory?: string;
  };
}
```

## Success Criteria

- [ ] Interface defined in single location (`@vue-skuilder/common`)
- [ ] No duplicate interface definitions remain
- [ ] Provider function (`allCustomQuestions`) explicitly typed with return type
- [ ] Consumer code has proper type annotations
- [ ] `inlineComponents` property included in interface (marked optional)
- [ ] All packages build without TypeScript errors
- [ ] Backwards compatibility maintained (re-export from standalone-ui)
- [ ] No runtime behavior changes

## Known Risks

### Risk 1: External Consumers
**Risk**: External packages may import `CustomQuestionsExport` from `standalone-ui`
**Mitigation**: Re-export the type from `standalone-ui` for backwards compatibility
**Severity**: Low (re-export solves this)

### Risk 2: Type Mismatches
**Risk**: `Displayable[]` vs specific question class types might cause issues
**Mitigation**: Verify that provider's specific classes are assignable to `Displayable[]`
**Severity**: Medium (requires verification)

### Risk 3: Missing `inlineComponents` Implementation
**Risk**: Interface declares property that provider doesn't return
**Mitigation**: Property is optional (`?`), existing code already handles absence
**Severity**: Low (already optional in practice)

### Risk 4: Build Order Dependencies
**Risk**: Common must build before standalone-ui and studio-ui
**Mitigation**: Already in correct order per CLAUDE.md build dependencies
**Severity**: Low (no change to existing order)

## Testing Strategy

1. **Type Checking**: Run `type-check` commands for all affected packages
2. **Build Testing**: Ensure clean builds for common → standalone-ui → studio-ui
3. **Import Testing**: Verify imports resolve correctly in both packages
4. **Runtime Testing**: Run existing E2E tests to verify no behavioral changes
5. **Backwards Compat**: Verify re-export works (can still import from standalone-ui)

## Administrative Tasks

1. Update package.json for common if needed (add exports)
2. Verify tsconfig paths/aliases handle new import locations
3. Update any relevant documentation
4. Consider updating CLAUDE.md if package relationships change

## Implementation Order

1. Phase 1: Create in common (foundational)
2. Phase 2: Update provider (establishes contract)
3. Phase 3: Update consumer utils (adopts contract)
4. Phase 4: Update consumer main (completes migration)
5. Phase 5: Build and verify (validates everything)

**Sequential execution required** - each phase depends on previous completion.

## Files Summary

### New Files (1)
- `packages/common/src/types/customQuestions.ts`

### Modified Files (4)
- `packages/common/src/types/index.ts`
- `packages/standalone-ui/src/questions/index.ts`
- `packages/studio-ui/src/utils/courseConfigRegistration.ts`
- `packages/studio-ui/src/main.ts`

### Total Changes
- 1 new file
- 4 modified files
- ~50 lines added
- ~30 lines removed
- Net impact: +20 lines, significantly improved type safety

---

**Ready to proceed with implementation?**
