# CourseWare Refactoring Plan

## Overview
Refactor the `courses` package to `courseware` with proper abstraction naming and dependency injection to resolve custom question integration issues in studio-ui.

## Current Problems
- **Naming confusion**: `Course` should refer to curriculum content collections, not rendering specifications
- **Global coupling**: `DataInputForm` hard-coded to use `allCourses` global registry
- **Platform-ui assumptions**: Assumes all rendering capabilities are globally available
- **Custom question integration**: Studio-ui can't inject custom questions into `DataInputForm`

## Solution Strategy
1. **Rename** `courses` package to `courseware` with proper abstractions
2. **Inject courseware** as prop to `DataInputForm` instead of global dependency
3. **Enable studio-ui** to construct custom courseware registry including custom questions

---

## Phase 1: Package Renaming & Core Refactoring
**Goal**: Rename package and core classes without breaking existing functionality

### 1.1 Rename Package Structure
- [x] Rename `packages/courses/` → `packages/courseware/`
- [x] Update `package.json` name: `@vue-skuilder/courses` → `@vue-skuilder/courseware`
- [x] Update workspace references in root `package.json` - No changes needed, uses `packages/*` pattern
- [x] Update all `package.json` dependencies across packages - Updated 5 packages using sed command
- [x] Update GitHub workflows (publish-npm.yml, standalone-e2e-tests.yml, courses-test.yml)
- [x] Update documentation files (CLAUDE.md files)
- [x] Update CLI references and template utilities
- [x] Update courseware type declarations and common-ui references

### 1.2 Rename Core Classes
- [x] Rename `Course.ts` → `CourseWare.ts`
- [x] Rename class `Course` → `CourseWare`
- [x] Update class references in `courseware/src/index.ts` - Updated CourseList class and export
- [x] Update imports in `courseware/src/default/index.ts` - Updated all domain index.ts files via sed commands

### 1.3 Update CourseWare Registry
- [x] Rename `CourseList` → `AllCourseWare`
- [x] Update method `getCourse()` → `getCourseWare()`
- [x] Update property `courseList` → `courseWareList`
- [x] Update export `allCourses` → `allCourseWare`

### 1.4 Update Import References
- [x] Update imports in `packages/platform-ui/` - Updated 5 files with allCourses → allCourseWare
- [x] Update imports in `packages/studio-ui/` - Updated via sed command
- [x] Update imports in `packages/standalone-ui/` - Updated via sed command 
- [x] Update imports in `packages/edit-ui/` - Updated via sed command
- [x] Update imports in `packages/db/` - Updated via sed command
- [x] Update imports in `packages/express/` - Updated via sed command

**Validation**: All packages build successfully with new naming

---

## Phase 2: DataInputForm Dependency Injection
**Goal**: Replace global `allCourseWare` dependency with injected courseware prop

### 2.1 Add CourseWare Prop to DataInputForm
- [x] Add `courseWare` prop to `DataInputForm.vue` with `AllCourseWare` type
- [x] Set default prop value to imported `allCourseWare` for backward compatibility
- [x] Add `PropType` import for proper typing

### 2.2 Replace Global Dependencies
- [x] Replace `allCourseWare.getCourse()` calls with `this.courseWare.getCourseWare()`
- [x] Update `getImplementingViews()` method to use injected courseware
- [x] Keep `allCourseWare` import for default value and type

### 2.3 Update DataInputForm Consumers
- [x] Update `CreateCardView.vue` to pass courseware prop (currently uses default)
- [x] Platform-ui usage preserved (uses default prop automatically)
- [x] Backward compatibility maintained

**Validation**: DataInputForm works with both default and custom courseware ✅

---

## Phase 3: Studio-UI Custom CourseWare Integration
**Goal**: Enable studio-ui to construct custom courseware including custom questions

### 3.1 Create Custom CourseWare Builder
- [x] Create `utils/customCourseWareBuilder.ts` in studio-ui
- [x] Function to merge default courseware with custom questions
- [x] Function to create `CourseWare` instances from custom questions  
- [x] Function to build `AllCourseWare` registry with custom content

### 3.2 Integrate Custom Questions into CourseWare
- [x] Convert custom questions to `CourseWare` instances using CourseWare constructor
- [x] Add custom `CourseWare` to `AllCourseWare` registry with conflict handling
- [x] Ensure custom questions available in courseware lookup
- [x] Maintain backward compatibility with existing questions

### 3.3 Update Studio-UI Components
- [x] Update `main.ts` to build custom courseware registry using buildStudioCourseWare()
- [x] Pass custom courseware to `CreateCardView` via provide/inject pattern
- [x] Update `CreateCardView` to use custom courseware in `DataInputForm` via courseWare prop
- [x] Update view components collection to use custom registry

**Validation**: Custom questions appear and render correctly in studio-ui CreateCard ✅

---

## Phase 4: Build System & Configuration Updates
**Goal**: Update build configurations and CLI integration

### 4.1 Update Build Configurations
- [ ] Update `vite.config.ts` in renamed courseware package
- [ ] Update `tsconfig.json` references
- [ ] Update `eslint.config.mjs` paths
- [ ] Update `CLAUDE.md` documentation

### 4.2 Update CLI Integration
- [ ] Update CLI import paths for courseware
- [ ] Update studio-ui build process to use courseware
- [ ] Update embedded sources in CLI dist
- [ ] Test CLI studio command with new courseware

### 4.3 Update Package Dependencies
- [ ] Update `@vue-skuilder/courses` → `@vue-skuilder/courseware` in all packages
- [ ] Update shared vite config aliases
- [ ] Update TypeScript path mappings
- [ ] Update workspace dependencies

**Validation**: All packages build and CLI studio command works

---

## Phase 5: Testing & Documentation
**Goal**: Ensure all functionality works and update documentation

### 5.1 Comprehensive Testing
- [ ] Test platform-ui with new courseware system
- [ ] Test studio-ui with custom questions
- [ ] Test standalone-ui rendering
- [ ] Test CLI studio command end-to-end
- [ ] Test package builds and npm publishing

### 5.2 Update Documentation
- [ ] Update `CLAUDE.md` files with new naming
- [ ] Update package README files
- [ ] Update inline code documentation
- [ ] Update architecture diagrams/comments

### 5.3 Performance Validation
- [ ] Verify no performance regressions
- [ ] Test courseware registry initialization
- [ ] Test custom question loading performance
- [ ] Test studio-ui startup time

**Validation**: All tests pass, documentation updated, performance maintained

---

## Phase 6: Cleanup & Optimization
**Goal**: Remove deprecated code and optimize new architecture

### 6.1 Remove Deprecated Code
- [ ] Remove any remaining `allCourses` global references
- [ ] Remove unused imports and exports
- [ ] Remove temporary compatibility layers
- [ ] Clean up console logging

### 6.2 Optimize CourseWare Registry
- [ ] Add caching for courseware lookups
- [ ] Optimize courseware construction
- [ ] Add lazy loading for large courseware sets
- [ ] Optimize view component registration

### 6.3 Final Testing
- [ ] Full regression testing
- [ ] Performance benchmarking
- [ ] Memory usage validation
- [ ] Bundle size analysis

**Validation**: Clean, optimized codebase with improved architecture

---

## Success Criteria
- [ ] Custom questions render correctly in studio-ui CreateCard
- [ ] No breaking changes to existing platform-ui functionality
- [ ] Improved architecture with proper dependency injection
- [ ] Clear separation between courseware (rendering specs) and courses (content)
- [ ] All packages build and publish successfully
- [ ] CLI studio command works with custom questions

## Risk Mitigation
- **Breaking Changes**: Maintain backward compatibility during transition
- **Performance**: Monitor bundle size and runtime performance
- **Testing**: Comprehensive testing at each phase
- **Rollback**: Keep git history clean for easy rollback if needed

## Estimated Timeline
- **Phase 1**: 2-3 hours (renaming and core refactoring)
- **Phase 2**: 3-4 hours (dependency injection)
- **Phase 3**: 2-3 hours (studio-ui integration)
- **Phase 4**: 2-3 hours (build system updates)
- **Phase 5**: 2-3 hours (testing and documentation)
- **Phase 6**: 1-2 hours (cleanup and optimization)

**Total**: 12-18 hours over multiple sessions