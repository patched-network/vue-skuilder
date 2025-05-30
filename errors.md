# Linting Errors Checklist

## Critical Errors (Must Fix to Unblock CI)

### Floating Promises (`@typescript-eslint/no-floating-promises`)
- [x] `packages/db/src/impl/pouch/courseAPI.ts#153` - `addTagToCard()` call not awaited ✅ **FIXED**
- [x] `packages/db/src/impl/pouch/courseAPI.ts#200` - `courseApi.getCardEloData().then()` missing error handler ✅ **FIXED**
- [x] `packages/db/src/impl/pouch/classroomDB.ts#92` - Promise not properly handled ✅ **FIXED**
- [x] `packages/db/src/impl/pouch/classroomDB.ts#125` - Promise not properly handled ✅ **FIXED**
- [x] `packages/db/src/impl/pouch/classroomDB.ts#241` - Promise not properly handled ✅ **FIXED**
- [x] `packages/db/src/impl/pouch/classroomDB.ts#244` - Promise not properly handled ✅ **FIXED**
- [x] `packages/db/src/impl/pouch/classroomDB.ts#247` - Promise not properly handled ✅ **FIXED**
- [x] `packages/db/src/impl/pouch/classroomDB.ts#279` - Database replication call not awaited ✅ **FIXED**

### Import Pattern Violations
- [x] `packages/db/src/core/navigators/index.ts#38` - Replace `require()` with ES module import ✅ **FIXED**
- [x] `packages/db/src/core/navigators/index.ts#38` - Fix "Require statement not part of import statement" ✅ **FIXED**

## High Priority Warnings (Treated as Errors in CI)

### Console Statements (`no-console`)
- [ ] `packages/db/src/impl/pouch/PouchDataLayerProvider.ts#43` - Remove/replace console.log
- [ ] `packages/db/src/impl/pouch/PouchDataLayerProvider.ts#51` - Remove/replace console.log
- [ ] `packages/db/src/impl/pouch/PouchDataLayerProvider.ts#57` - Remove/replace console.log
- [ ] `packages/db/src/impl/pouch/PouchDataLayerProvider.ts#60` - Remove/replace console.error
- [ ] `packages/db/src/factory.ts#40` - Remove/replace console.warn
- [ ] `packages/db/src/core/types/types-legacy.ts#7` - Remove/replace console.log in `log()` function
- [ ] `packages/db/src/core/navigators/index.ts#42` - Remove/replace console.log
- [ ] `packages/db/src/core/bulkImport/cardProcessor.ts#26` - Remove/replace console statement
- [ ] `packages/db/src/core/bulkImport/cardProcessor.ts#123` - Remove/replace console statement

### Missing Return Types (`@typescript-eslint/explicit-function-return-type`)
- [ ] `packages/db/src/core/types/types-legacy.ts#6` - Add return type to `log()` function

## Resolution Strategies

### For Floating Promises:
1. **Add `await`** if the result is needed
2. **Add `.catch()`** for fire-and-forget operations  
3. **Use `void`** operator to explicitly ignore promises
4. **Add proper error handling** with try/catch blocks

### For Console Statements:
1. **Remove debug statements** from production code
2. **Replace with proper logging framework** if needed
3. **Use conditional logging** based on environment
4. **Consider using eslint-disable comments** for critical debugging

### For Import Patterns:
1. **Convert `require()` to `import`** statements
2. **Use dynamic imports** for conditional loading
3. **Update module resolution** if needed



## Verification Commands

```bash
# Check specific package
yarn workspace @vue-skuilder/db lint:check

# Auto-fix what's possible
yarn workspace @vue-skuilder/db lint:fix

# Verify all packages
yarn build
```

## Progress Tracking

**Total Critical Errors:** 10
**Total High Priority Warnings:** 10
**Estimated Fix Time:** 3-6 hours

**Completion Status:** 10/20 items fixed
**Critical Errors Remaining:** 0/10 ✅ **ALL CRITICAL ERRORS FIXED!**
**Floating Promises:** ✅ **ALL FIXED** (8/8)
**Import Patterns:** ✅ **ALL FIXED** (2/2)

---

*Last Updated: [Date of CI failure analysis]*
*CI Build Reference: v0.1.0 Publish to NPM · 15329080488*