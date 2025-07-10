# Todo: Studio-UI Local Question Types Integration

Phased implementation plan for enabling studio-ui to discover and use local question types from scaffolded course projects.

## Phase 1: CLI Build Infrastructure

1.1 ✅ **Bundle Studio-UI Source in CLI** 
  - [x] Modify CLI package to include `studio-ui/src/` directory
  - [x] Update CLI build process to bundle studio-ui source
  - [x] Remove pre-built studio-ui bundle from CLI package
  - [x] Update `packages/cli/package.json` to add studio-ui source files
  - [x] Update `packages/cli/build.config.ts` to include studio-ui source in build
  - [x] Update `packages/cli/src/` studio command imports

**Context added:**
- CLI now bundles studio-ui source instead of pre-built assets
- Build process: `embed:studio-ui-src` copies source files to `dist/studio-ui-src/`
- Added Vite build dependencies to CLI: `@vitejs/plugin-vue`, `vite`, `vue-tsc`
- Studio command updated to serve from `studio-ui-src` instead of `studio-ui-assets`
- **Next:** Still need to implement actual build-on-demand logic for questions integration

1.2 ✅ **Bundle Studio-UI Build Dependencies**
  - [x] Add Vite, Vue, TypeScript, and other studio-ui build deps to CLI package
  - [x] Ensure version compatibility with existing scaffolded course dependencies
  - [x] Test that CLI can successfully build studio-ui from source
  - [x] Update `packages/cli/package.json` with studio-ui build dependencies

**Context added:**
- Added all studio-ui runtime dependencies to CLI: Vue 3.5.13, Vuetify 3.7.0, Vue Router 4.2.0, Pinia 2.3.0, @mdi/font, and vue-skuilder packages
- Added Vite build dependencies: @vitejs/plugin-vue 5.2.1, vite 6.0.9, vue-tsc 1.8.0
- Versions confirmed compatible with standalone-ui dependencies
- Embed script updated to include all required config files (tsconfig.node.json, vite.config.base.js)
- Build paths fixed automatically (import paths, HTML script src)
- **Note:** Full build testing requires scaffolded course context (for monorepo dependencies), but CLI has all needed build tools

1.3
- [ ] **Create .skuilder Directory Structure**
  - [ ] Create `.skuilder/studio-builds/` directory structure
  - [ ] Add `.skuilder/` to default gitignore in scaffolding process
  - [ ] Create stern README about generated contents
  - [ ] Create template `.skuilder/README.md` for scaffolded projects
  - [ ] Update CLI scaffolding to create `.skuilder/` and gitignore entry

## Phase 2: CLI Studio Command Rework

2.1
- [ ] **Implement Questions Directory Hashing**
  - [ ] Create hash function for `src/questions/` directory contents
  - [ ] Handle case where `src/questions/` doesn't exist (treat as "no questions")
  - [ ] Store hash for comparison between runs
  - [ ] Update `packages/cli/src/commands/studio.ts` with hashing logic
  - [ ] Create utility functions for directory hashing

2.2
- [ ] **Build Cache Management**
  - [ ] Implement cache checking logic in `.skuilder/studio-builds/[hash]/`
  - [ ] Create cache directory structure as needed
  - [ ] Handle cleanup of old builds (optional optimization)
  - [ ] Update `packages/cli/src/commands/studio.ts` with cache management
  - [ ] Create cache utilities for build management

2.3
- [ ] **Rebuild Logic Implementation**
  - [ ] Compare current questions hash with cached build hash
  - [ ] Implement rebuild decision logic
  - [ ] Handle "no questions" scenario (use default studio-ui behavior)
  - [ ] Update `packages/cli/src/commands/studio.ts` with rebuild logic
  - [ ] Create rebuild orchestration functions

2.4
- [ ] **Build Error Handling and Fallback**
  - [ ] Implement fallback to basic studio-ui for build failures
  - [ ] Create error reporting mechanism for failed builds
  - [ ] Ensure studio command doesn't crash on build errors
  - [ ] Update `packages/cli/src/commands/studio.ts` with error handling
  - [ ] Create error reporting utilities

## Phase 3: Questions Integration Strategy

3.1
- [ ] **Design Questions Bundling Mechanism**
  - [ ] Evaluate options: Vite aliases, file copying, component library approach
  - [ ] Prototype chosen approach
  - [ ] Document decision and rationale

3.2
- [ ] **Implement Questions Source Integration**
  - [ ] Implement chosen bundling mechanism
  - [ ] Modify studio-ui build process to include local questions
  - [ ] Handle questions with complex dependencies
  - [ ] Update `packages/cli/src/commands/studio.ts` with questions integration
  - [ ] Update studio-ui build configuration (approach-dependent)

3.3
- [ ] **Handle "No Questions" Scenario**
  - [ ] Detect absence of `src/questions/` directory
  - [ ] Configure studio-ui to use default question types only
  - [ ] Provide user feedback about available question types
  - [ ] Update `packages/cli/src/commands/studio.ts` with no-questions handling
  - [ ] Configure studio-ui for default behavior

3.4
- [ ] **Build Error Reporting**
  - [ ] Capture TypeScript compilation errors from questions
  - [ ] Report failed question imports
  - [ ] Display errors in studio-ui interface
  - [ ] Update `packages/cli/src/commands/studio.ts` with error capture
  - [ ] Create studio-ui error reporting interface

## Phase 4: Studio-UI Enhancement

4.1
- [ ] **Auto-Register Local Question Types**
  - [ ] Modify studio-ui startup to discover local questions
  - [ ] Auto-register local types in allCourses
  - [ ] Handle type conflicts and namespacing
  - [ ] Update `packages/studio-ui/src/main.ts` with auto-registration
  - [ ] Configure studio-ui for local types

4.2
- [ ] **Enhanced CreateCardView Selector**
  - [ ] Update CreateCardView to display local types
  - [ ] Fix selector visibility (`availableDataShapes.length > 1`)
  - [ ] Add visual distinction for local vs. built-in types
  - [ ] Update `packages/studio-ui/src/views/CreateCardView.vue` with enhanced selector
  - [ ] Add local type detection and display

4.3
- [ ] **Build Error Reporting UI**
  - [ ] Create error display components
  - [ ] Show build status and error messages
  - [ ] Provide guidance for fixing common issues
  - [ ] Create studio-ui error reporting components
  - [ ] Create build status indicator in studio-ui interface

4.4
- [ ] **End-to-End Workflow Testing**
  - [ ] Test with scaffolded course containing local questions
  - [ ] Verify rebuild triggers on questions changes
  - [ ] Test error scenarios and fallback behavior
  - [ ] Document developer workflow
  - [ ] Test fresh scaffolded course with custom questions
  - [ ] Test questions with TypeScript errors
  - [ ] Test questions with complex dependencies
  - [ ] Test no questions directory scenario

## Deferred Tasks

- [ ] **Hot Reload Support**
  - [ ] Watch `src/questions/` directory for changes
  - [ ] Trigger studio-ui rebuild on file changes
  - [ ] Implement without full page reload

- [ ] **Pre-built Studio-UI Bundling**
  - [ ] Bundle default studio-ui build in CLI for first startup performance
  - [ ] Optimize initial studio command startup time

- [ ] **Complex Dependency Management**
  - [ ] Handle questions with npm dependencies not in course project
  - [ ] Support questions with custom build steps
  - [ ] Advanced component library integration

## Success Criteria

1. **Developer Experience**: Local question types immediately available in studio-ui
2. **Performance**: Reasonable startup time with caching
3. **Reliability**: Graceful handling of build errors and edge cases
4. **Maintainability**: Clear separation of concerns between CLI and studio-ui
5. **Compatibility**: Works with existing scaffolded course structure
