# Edit UI Migration Todo - Option C Implementation

## Phase 1: Package Foundation & Core Components
**Goal**: Establish @vue-skuilder/edit-ui package with essential editing components

### 1.1 Package Setup
- [ ] Create `packages/edit-ui/` directory structure
- [ ] Configure package.json with proper dependencies
- [ ] Set up TypeScript configuration extending base
- [ ] Configure Vite build for library output
- [ ] Add to monorepo build pipeline
- [ ] Update root package.json workspace dependencies

### 1.2 Core Component Migration (Priority 1)
**Target**: 4 high-value components (~2,400 lines)

- [ ] `git mv` CourseEditor.vue from platform-ui to edit-ui
- [ ] `git mv` DataInputForm.vue from platform-ui to edit-ui  
- [ ] `git mv` BulkImportView.vue from platform-ui to edit-ui
- [ ] `git mv` FieldInputs/ directory (9 components) from platform-ui to edit-ui

### 1.3 Dependency Resolution
- [ ] Audit and resolve platform-ui specific imports
- [ ] Update component imports to use @vue-skuilder/common-ui
- [ ] Extract any platform-ui utilities needed by edit components
- [ ] Create edit-ui specific composables/utilities as needed

## Phase 2: Consumer Integration
**Goal**: Update studio-ui and platform-ui to consume edit-ui

### 2.1 Studio-UI Integration
- [ ] Add @vue-skuilder/edit-ui dependency to studio-ui
- [ ] Update studio-ui imports to use edit-ui components
- [ ] Test full editing workflow in studio-ui
- [ ] Verify bundle size impact (target: +~800KB)

### 2.2 Platform-UI Integration  
- [ ] Add @vue-skuilder/edit-ui dependency to platform-ui
- [ ] Update platform-ui imports to use edit-ui components
- [ ] Remove migrated edit components from platform-ui
- [ ] Test platform-ui editing functionality unchanged
- [ ] Verify bundle size optimization

### 2.3 Build & Test Verification
- [ ] Run full test suites for both consumers
- [ ] Verify dev server functionality
- [ ] Test production builds
- [ ] Confirm standalone-ui unaffected (no size increase)

## Phase 3: Advanced Components & Cleanup
**Goal**: Complete component migration and optimize

### 3.1 Specialized Components (Priority 2) 
- [ ] Migrate ComponentRegistration.vue (complex platform-ui deps)
- [ ] Migrate NavigationStrategyEditor.vue  
- [ ] Resolve deep platform-ui integrations
- [ ] Create edit-ui specific stores/services as needed

### 3.2 Documentation & Examples
- [ ] Create edit-ui README with component usage
- [ ] Document component API and props
- [ ] Add Storybook stories for edit components
- [ ] Create migration guide for future components

### 3.3 Final Cleanup
- [ ] Remove unused edit imports from platform-ui
- [ ] Optimize edit-ui bundle size
- [ ] Verify tree-shaking works correctly
- [ ] Update monorepo documentation

## Success Criteria

### Bundle Size Targets
- [ ] standalone-ui: No size increase (stays ~5-8MB)  
- [ ] studio-ui: +~800KB for editing capability
- [ ] platform-ui: Neutral/slight decrease after cleanup
- [ ] edit-ui: ~800KB standalone package

### Functional Requirements
- [ ] All editing workflows work in studio-ui
- [ ] All editing workflows work in platform-ui  
- [ ] No regression in editing functionality
- [ ] Clean component separation achieved

### Architecture Goals
- [ ] Zero coupling between display (common-ui) and editing (edit-ui)
- [ ] Clean import paths: @vue-skuilder/edit-ui
- [ ] Proper TypeScript exports and types
- [ ] Maintainable build pipeline

## Risk Mitigation

### High-Risk Components
- **ComponentRegistration.vue**: Deep platform-ui integration
  - Mitigation: Extract platform-ui utilities to shared location
- **Complex state management**: Edit components may have tight coupling
  - Mitigation: Create edit-ui specific stores/composables

### Testing Strategy
- Test after each phase completion
- Maintain feature parity throughout migration
- Bundle analysis after each major change
- Rollback plan: Keep git history clean with proper `git mv` usage

## Timeline Estimate
- **Phase 1**: 2-3 days (package setup + core migration)
- **Phase 2**: 2-3 days (consumer integration + testing)  
- **Phase 3**: 2-4 days (complex components + cleanup)
- **Total**: 6-10 days

## Notes
- Use `git mv` for all component migrations to retain history
- Test bundle sizes frequently during migration
- Prioritize standalone-ui protection (zero bloat requirement)
- Consider gradual rollout if issues arise