# Assessment: CustomQuestionsExport Interface Architecture

## Problem Statement

The `CustomQuestionsExport` interface is currently defined in `packages/standalone-ui/src/questions/index.ts` (the provider package), but it should be defined where it's actually **consumed** and used for type constraints. This violates the principle of "define types at consumption boundaries."

## Current State

### 1. Provider Side (`standalone-ui`)
- **File**: `packages/standalone-ui/src/questions/index.ts:103-118`
- Exports interface `CustomQuestionsExport` with 5 properties
- Exports function `allCustomQuestions()` that returns matching structure
- **Problem**: Function is NOT explicitly typed with the interface it defines

### 2. Consumer Side (`studio-ui`)
Has **two different consumption points** with inconsistent typing:

#### A. `studio-ui/src/utils/courseConfigRegistration.ts:9-22`
- **REDEFINES** interface as `CustomQuestionsData` (different name!)
- Type differences from provider:
  - `questionClasses`: uses `Displayable[]` vs specific class types
  - `views`: uses `ViewComponent[]` vs `Array<{ name: string; component: ViewComponent }>`
- Uses this interface for type constraints on processing functions

#### B. `studio-ui/src/main.ts:90-235`
- **NO TYPE ANNOTATION** on the consumed object (uses `any` in places)
- Uses optional chaining for safe access
- Accesses **undocumented property**: `customQuestions.inlineComponents` (line 228-231)
  - This property is NOT in either interface definition!
  - This property is NOT returned by `allCustomQuestions()`
  - This is a **contract violation**

## Key Issues

### Issue 1: Type Definition Location
**Current**: Interface defined in provider package
**Problem**: The consumer has to trust the provider's interface, but then redefines its own anyway
**Impact**: Two sources of truth, potential drift

### Issue 2: Missing Property in Contract
**Current**: `inlineComponents` is used but not defined anywhere
**Problem**: Runtime usage without compile-time safety
**Impact**: Silent failures possible

### Issue 3: Unused Properties
**Current**: `dataShapes` and `meta` are exported but never used in `main.ts`
**Problem**: Unnecessary complexity in interface
**Impact**: Confusion about what's actually needed

### Issue 4: Type Inconsistencies
**Current**: Same properties have different types in provider vs consumer
**Examples**:
- `views`: object with name+component vs just components
- `questionClasses`: specific types vs generic `Displayable[]`

### Issue 5: No Type Safety at Main Consumer
**Current**: `studio-ui/src/main.ts` uses the object without proper typing
**Problem**: No compile-time checking of property access
**Impact**: Runtime errors possible

## Usage Analysis

What's actually used from the exported object:

| Property | Used in main.ts | Used elsewhere | Keep? |
|----------|----------------|----------------|-------|
| `courses` | ✅ Yes (line 185-198) | Registration utils | ✅ Yes |
| `views` | ✅ Yes (line 206-214) | Registration utils | ✅ Yes |
| `questionClasses` | ⚠️ Logging only (line 93) | Registration utils | ✅ Yes |
| `dataShapes` | ❌ No | Registration utils | ✅ Yes (indirect) |
| `meta` | ❌ No | Registration utils | ⚠️ Maybe |
| `inlineComponents` | ✅ Yes (line 228-231) | N/A | ✅ **MISSING!** |

## Options

### Option A: Move Interface to Consumer Package
**Move** `CustomQuestionsExport` to `studio-ui/src/types/customQuestions.ts`

**Pros**:
- Consumer defines the contract it needs
- Single source of truth at consumption boundary
- Provider can import and use it for type safety
- Follows dependency inversion principle

**Cons**:
- Provider package depends on consumer for types (circular if not careful)
- Slightly unusual pattern in monorepo

**Mitigation**: Use a shared `@vue-skuilder/common` type definition

### Option B: Move Interface to Common Package
**Move** `CustomQuestionsExport` to `@vue-skuilder/common` types

**Pros**:
- Shared contract accessible to both
- No circular dependencies
- Clear separation of interface from implementation
- Aligns with existing pattern (DataShape, ViewComponent already in common)

**Cons**:
- Another place to look for types
- Common package gets larger

### Option C: Keep in Provider, Fix Consumer
**Keep** interface in `standalone-ui`, make consumer use it properly

**Pros**:
- Minimal code movement
- Provider "owns" the contract

**Cons**:
- Doesn't solve the architectural problem
- Consumer still needs to redefine for its specific needs
- Doesn't follow "define at boundary" principle

## Recommended Approach

**Option B: Move to Common Package** with these changes:

1. **Create shared interface** in `@vue-skuilder/common/src/types/customQuestions.ts`
2. **Include `inlineComponents`** property (currently missing)
3. **Simplify types** based on actual usage:
   - `views`: Keep as `Array<{ name: string; component: ViewComponent }>` (provider needs names)
   - `questionClasses`: Use `Displayable[]` (consumer's actual need)
4. **Type the provider function** explicitly with the interface
5. **Remove consumer's duplicate interface** (`CustomQuestionsData`)
6. **Type the consumer usage** in `main.ts` properly
7. **Simplify `meta`** to only what's actually used

### Interface Structure (Proposed)

```typescript
// In @vue-skuilder/common/src/types/customQuestions.ts
export interface CustomQuestionsExport {
  courses: CourseWare[];
  questionClasses: Displayable[];
  dataShapes: DataShape[];
  views: Array<{
    name: string;
    component: ViewComponent;
  }>;
  inlineComponents?: Record<string, ViewComponent>;
  meta?: {
    packageName: string;
    sourceDirectory: string;
  };
}
```

### Benefits of This Approach
- ✅ Single source of truth
- ✅ No circular dependencies
- ✅ Both provider and consumer use same types
- ✅ Includes the missing `inlineComponents` property
- ✅ Simplified to actual usage
- ✅ Follows existing common package pattern

## Files Requiring Changes

1. `packages/common/src/types/customQuestions.ts` - NEW, interface definition
2. `packages/common/src/types/index.ts` - Add export
3. `packages/standalone-ui/src/questions/index.ts` - Remove interface, import from common, type function
4. `packages/studio-ui/src/utils/courseConfigRegistration.ts` - Remove `CustomQuestionsData`, import from common
5. `packages/studio-ui/src/main.ts` - Add type annotation to `customQuestions` variable

## Risks

1. **Breaking Change**: Consumers outside monorepo might import `CustomQuestionsExport` from `standalone-ui`
   - **Mitigation**: Re-export from `standalone-ui` for backwards compatibility

2. **`inlineComponents` Not Implemented**: Adding it to interface but provider doesn't return it yet
   - **Mitigation**: Make it optional (`?`), document as future enhancement

3. **Type Complexity**: Shared types might not fit all use cases
   - **Mitigation**: Use generics or union types if needed

## Success Criteria

- [ ] Single interface definition in one location
- [ ] Both provider and consumer use the same interface
- [ ] All actually-used properties are documented in interface
- [ ] Provider function explicitly typed
- [ ] Consumer code has proper type annotations
- [ ] No duplicate interface definitions
- [ ] Tests pass, no type errors

## Recommendation

Proceed with **Option B**: Move interface to `@vue-skuilder/common` with the simplified structure based on actual usage. This provides the cleanest architecture with proper separation of concerns.

Next step: Create detailed implementation plan?
