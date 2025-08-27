# Todo: StudySession Integration Implementation

## Phase 1: Core Infrastructure

### 1.1 Static Data Layer Composable
- [x] 1.1.1 Create `docs/.vitepress/theme/composables/useStaticDataLayer.ts`
  - [x] 1.1.1.1 Import required types from `@vue-skuilder/db`
  - [x] 1.1.1.2 Implement composable with error handling
  - [x] 1.1.1.3 Configure localStorage persistence with 'docs-skuilder' prefix (removed - not applicable for browser)
  - [x] 1.1.1.4 Add support for multiple course IDs
- [x] 1.1.2 Test composable in isolation
  - [x] 1.1.2.1 Create simple test component
  - [x] 1.1.2.2 Verify data layer initialization
  - [x] 1.1.2.3 Test error handling scenarios

### 1.2 Demo Course Data Creation (deferred - working against existing course w/ ID 2aeb8315ef78f3e89ca386992d00825b currently in the public folder)
- [ ] 1.2.1 Create directory structure `docs/public/static-courses/`
- [ ] 1.2.2 Create demo course manifest and data
  - [ ] 1.2.2.1 Create `docs/public/static-courses/demo-course/manifest.json`
  - [ ] 1.2.2.2 Create sample cards with "Is Skuilder Cool?" theme
    - [ ] 1.2.2.2.1 Basic yes/no question card
    - [ ] 1.2.2.2.2 Multiple choice platform features card
    - [ ] 1.2.2.2.3 Fill-in-the-blank SRS concepts card
    - [ ] 1.2.2.2.4 Placeholder for future mic-based question
  - [ ] 1.2.2.3 Create course registry `docs/public/static-courses/index.json`
- [ ] 1.2.3 Verify course data structure matches `StaticDataLayerProvider` expectations

### 1.3 EmbeddedCourse Component
- [x] 1.3.1 Create `docs/.vitepress/theme/components/EmbeddedCourse.vue`
  - [x] 1.3.1.1 Import required components from `@vue-skuilder/common-ui`
  - [x] 1.3.1.2 Implement props interface (courseId, sessionTimeLimit, etc.)
  - [x] 1.3.1.3 Integrate `useStaticDataLayer` composable
  - [x] 1.3.1.4 Handle loading states and error boundaries
  - [x] 1.3.1.5 Wire up StudySession component with proper props
- [x] 1.3.2 Implement error handling strategy
  - [x] 1.3.2.1 Console error logging
  - [x] 1.3.2.2 Graceful degradation (hide component on failure)
  - [x] 1.3.2.3 Loading state during async initialization

### 1.4 VitePress Integration Infrastructure
- [x] 1.4.1 Configure Vuetify in VitePress theme
  - [x] 1.4.1.1 Add Vuetify + MDI icons to theme/index.ts
  - [x] 1.4.1.2 Configure component library styles
  - [x] 1.4.1.3 Register global components (EmbeddedCourse, HeroStudySession)
- [x] 1.4.2 Fix VitePress alias resolution
  - [x] 1.4.2.1 Add intra-package aliases (@courseware, @cui, etc.)
  - [x] 1.4.2.2 Fix style import aliases (priority order)
  - [x] 1.4.2.3 Update optimizeDeps and SSR config
- [x] 1.4.3 Test build process
  - [x] 1.4.3.1 Verify yarn docs:build succeeds
  - [x] 1.4.3.2 Confirm component rendering

## Phase 2: Hero Integration

### 2.1 HeroStudySession Wrapper
- [ ] 2.1.1 Create `docs/.vitepress/theme/components/HeroStudySession.vue`
  - [ ] 2.1.1.1 Thin wrapper around EmbeddedCourse
  - [ ] 2.1.1.2 Hero-specific styling constraints
  - [ ] 2.1.1.3 Fixed demo-course ID and session time limit
- [ ] 2.1.2 Style for hero section integration
  - [ ] 2.1.2.1 Match existing CustomVPHero aesthetic
  - [ ] 2.1.2.2 Handle responsive behavior
  - [ ] 2.1.2.3 Integrate with fullscreen toggle functionality

### 2.2 CustomVPHero Integration
- [ ] 2.2.1 Update `docs/.vitepress/theme/components/CustomVPHero.vue`
  - [ ] 2.2.1.1 Replace placeholder content with HeroStudySession
  - [ ] 2.2.1.2 Import and register HeroStudySession component
  - [ ] 2.2.1.3 Remove placeholder demo styles
- [ ] 2.2.2 Test hero integration
  - [ ] 2.2.2.1 Verify component renders in hero section
  - [ ] 2.2.2.2 Test responsive behavior (desktop/mobile)
  - [ ] 2.2.2.3 Test fullscreen functionality works with real component

### 2.3 Theme Registration
- [ ] 2.3.1 Update `docs/.vitepress/theme/index.ts`
  - [ ] 2.3.1.1 Import EmbeddedCourse and HeroStudySession
  - [ ] 2.3.1.2 Register components globally for docs usage
- [ ] 2.3.2 Test component registration
  - [ ] 2.3.2.1 Verify components available throughout docs
  - [ ] 2.3.2.2 Test import resolution works correctly

### 2.4 End-to-End Hero Testing
- [ ] 2.4.1 Test complete study session flow in hero
- [ ] 2.4.2 Verify localStorage persistence works
- [ ] 2.4.3 Test session completion and restart
- [ ] 2.4.4 Test error scenarios and graceful degradation

## Phase 3: Future Expansion Framework

### 3.1 Documentation and Usage Patterns
- [ ] 3.1.1 Document EmbeddedCourse usage pattern
  - [ ] 3.1.1.1 Create usage examples
  - [ ] 3.1.1.2 Document props interface
  - [ ] 3.1.1.3 Document course data structure requirements
- [ ] 3.1.2 Create example usage in docs pages
  - [ ] 3.1.2.1 Add example to cards.md or similar
  - [ ] 3.1.2.2 Test embedding in regular docs content

### 3.2 Sample Library Internals Course
- [ ] 3.2.1 Create placeholder library internals course
  - [ ] 3.2.1.1 Course on "Data Layer API Basics"
  - [ ] 3.2.1.2 Simple cards explaining key concepts
  - [ ] 3.2.1.3 Update course registry with new course
- [ ] 3.2.2 Test multi-course scenarios
  - [ ] 3.2.2.1 Verify multiple courses can be loaded
  - [ ] 3.2.2.2 Test course switching and persistence isolation

### 3.3 Infrastructure Polish
- [ ] 3.3.1 Add TypeScript types for course data structure
- [ ] 3.3.2 Improve error messages and debugging
- [ ] 3.3.3 Add loading performance optimizations
- [ ] 3.3.4 Add course validation utilities

## Phase 4: Advanced Features (Future Work)

### 4.1 Advanced Question Types Framework
- [ ] 4.1.1 Research mic-based singing exercise integration
- [ ] 4.1.2 Create placeholder question type structure
- [ ] 4.1.3 Document custom question type creation process

### 4.2 Enhanced Demo Content
- [ ] 4.2.1 Add more tongue-in-cheek questions
- [ ] 4.2.2 Include media assets (images, audio)
- [ ] 4.2.3 Create progression that showcases different question types

### 4.3 Performance and Polish
- [ ] 4.3.1 Bundle size optimization
- [ ] 4.3.2 Lazy loading strategies
- [ ] 4.3.3 Animation and transition polish
- [ ] 4.3.4 Mobile experience optimization

---

## Notes Section

### Completed Items Commentary
**1.1.1 useStaticDataLayer composable**: ✅ Created following testproject pattern
- Loads individual manifests from `./static-courses/${courseId}/manifest.json` 
- Constructs manifests object programmatically (not from index.json registry)
- Removed localStorage prefix (not applicable for browser environment)
- Full error handling and loading states

**1.1.2 Test composable**: ✅ Created StaticDataLayerTest component and verified working
- Added to `/docs/workingdoc.md` for testing
- Added URL probing functionality that identified correct path pattern
- Successfully initialized with: Username "Me", Courses DB available

**1.3.1 EmbeddedCourse component**: ✅ Created reusable StudySession wrapper
- Props interface: courseId, sessionTimeLimit, sessionConfig
- Full integration with useStaticDataLayer composable
- Error boundaries and loading states implemented
- All StudySession events wired up with handlers

**1.4.1 VitePress Vuetify Integration**: ✅ Complete framework setup
- Vuetify + MDI icons configured in theme/index.ts
- Component library styles (@vue-skuilder/courseware/style, @vue-skuilder/common-ui/style)
- Global component registration (EmbeddedCourse, HeroStudySession)
- Fixed VitePress alias resolution for intra-package imports
- Build process working (yarn docs:build succeeds)

**2.1.1 HeroStudySession wrapper**: ✅ Hero-specific component created
- Thin wrapper around EmbeddedCourse for hero integration
- Hero-specific styling and debug info hidden

### Technical Discoveries
**StaticDataLayerProvider Pattern**: Initially assumed index.json registry was needed, but `packages/cli/testproject/src/main.ts` shows the correct pattern:
- Each course manifest loaded individually: `fetch(\`/static-courses/\${courseId}/manifest.json\`)`
- Manifests object constructed as: `{ [courseId]: manifest }`
- No central registry file required

**VitePress Asset Path Resolution**: URL probing revealed:
- Absolute paths like `/static-courses/` return 404
- Relative paths like `./static-courses/` work correctly (200)  
- VitePress serves assets relative to current page location
- Using `./` notation provides robustness across different base path configurations

**VitePress Alias Resolution Priority**: Critical ordering for style imports:
- Style-specific aliases (`@vue-skuilder/courseware/style`) must come BEFORE general package aliases
- General package aliases resolve to `src/` but styles need `dist/assets/index.css`
- Vite processes aliases in order - most specific first prevents conflicts

**StudySession Partial Functionality**: Component renders and processes responses:
- Questions render correctly with proper text
- Confetti triggers on correct answers (component logic working)
- StudySessionTimer renders but doesn't tick (timeout not initialized?)
- Question advancement blocked (session controller not advancing?)
- "Start Session" button condition not met (auto-advance to questions)

### Next Steps Adjustments
**Current Status**: EmbeddedCourse component successfully renders StudySession with Vuetify integration working. Question rendering and basic response processing functional, but session lifecycle has issues.

**Immediate Priority**: Debug StudySession initialization flow
1. Investigate why component auto-advances to questions without "Start Session" button
2. Fix timer initialization - StudySessionTimer component renders but doesn't countdown
3. Debug question advancement after correct answers - responses processed but cards don't progress

**Pending Hero Integration**: Once StudySession functionality is fully debugged, integrate with CustomVPHero to replace placeholder content.

**Discovered Pattern**: Full StudySession integration in VitePress is feasible - all major components (data layer, Vuetify, course loading) working. Issues are in session management logic rather than infrastructure.
