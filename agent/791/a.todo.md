# Studio Mode Implementation Todo

## Phase 1: CLI Foundation ✅ COMPLETED
- [x] Add `studio` command to CLI with basic sui course detection
- [x] Implement temporary CouchDB instance management in CLI (stubbed)
- [x] Add CouchDB cleanup on process exit/signals (stubbed)
- [x] Create studio-specific configuration loading

## Phase 2: Course Detection & Validation ✅ COMPLETED
- [x] Implement sui course structure detection logic
- [x] Handle edge cases (non-sui courses, malformed structures) with fail-fast approach

## Phase 3: Database Integration ✅ COMPLETED
- [x] Create generic CouchDB manager in common package (reusable across monorepo)
- [x] Implement actual Docker CouchDB management (no submodule dependency)
- [x] Implement studio mode using blank CouchDB (clean, isolated instances)
- [x] Implement automatic database cleanup on studio exit
- [x] Add database port conflict detection/resolution
- [x] Use consistent CouchDB version (couchdb:3.4.3)

## Phase 4: Course Data Integration ✅ COMPLETED
- [x] Use existing unpack command with --database flag for temp studio databases
- [x] Integrate course data population into studio CouchDB  
- [x] Test round-trip: static course → CouchDB → studio editing
- [x] Handle both static-data/ and public/static-courses/ course structures
- [x] Fixed ES module compatibility (__dirname issue)
- [x] Successfully migrated 488 documents + design docs in test

## Phase 5: Studio-UI Package Creation ✅ COMPLETED
- [x] Create new @vue-skuilder/studio-ui package with minimal dependencies
- [x] Implement App.vue wrapper around CourseInformation component
- [x] Add basic Vue app initialization with data layer configuration  
- [x] Configure Vite build system using shared config
- [x] Fix auth store integration - use common-ui's singleton auth store correctly
- [x] CourseInformation component rendering successfully with admin authentication
- [x] Clean UI without debug elements

## Phase 6: Studio-UI Features 🚧 IN PROGRESS
- [ ] **CURRENT**: Add StudioFlush component with "Flush to Static" functionality
- [ ] Implement flush functionality that calls existing `pack` CLI command or reuses `db` pack utils
- [ ] Add flush status/progress feedback in studio-ui
- [ ] Handle flush errors gracefully with user feedback
- [ ] Integrate StudioFlush into studio-ui App.vue
- [ ] Fix Material Design Icons font loading issues (cosmetic)

## Phase 7: Studio-UI Integration ✅ COMPLETED
- [x] Implement build-time embedding of studio-ui in CLI package
- [x] Add studio-ui as devDependency to CLI package.json
- [x] Enhance CLI build process to build and embed studio-ui assets
- [x] Add static file server to studio command (Node.js HTTP server)
- [x] Modify studio-ui to accept CouchDB connection via URL parameters
- [x] Implement automatic browser launch for studio session
- [x] Create graceful shutdown handling for all processes
- [x] Add studio session logging/debugging
- [x] Fix CORS configuration in CouchDB (chttpd/enable_cors + cors section)
- [x] Fix database name parsing (remove coursedb- prefix for studio-ui)
- [x] Implement source maps for better debugging experience

## Phase 8: SUI Package Integration
- [ ] Add studio-ui as devDependency to sui package template (lighter than platform-ui)
- [ ] Add `yarn studio` script to sui package template
- [ ] Update sui documentation with studio mode instructions
- [ ] Add studio mode to sui development workflow
- [ ] Test studio mode with existing sui courses

## Phase 9: Developer Experience
- [ ] Add studio command help/documentation
- [ ] Create basic studio mode documentation
- [ ] Add studio-ui package to monorepo build system

## Phase 10: Testing & Validation
- [ ] Test studio mode with various sui course structures
- [ ] Validate round-trip editing (unpack → edit → flush → pack)
- [ ] Test concurrent studio sessions
- [ ] Validate cleanup on various exit scenarios
- [ ] Test studio-ui editing capabilities vs platform-ui

## Phase 11: Documentation & Polish
- [ ] Update CLI documentation with studio command
- [ ] Add studio mode to main development documentation
- [ ] Document studio-ui package architecture and usage
- [ ] Add studio mode to CI/testing if applicable

## Phase 12: Integration Testing
- [ ] Test studio mode integration with existing course development workflow
- [ ] Validate studio mode works with course deployment pipeline
- [ ] Test flush functionality with different course types/structures
- [ ] Performance comparison: studio-ui vs platform-ui startup times
