# @vue-skuilder/standalone-ui Package

Standalone Vue 3 application for course consumption without the full platform authoring interface.

## Commands
- Dev: `yarn workspace @vue-skuilder/standalone-ui dev` (Vite dev server, port 6173)
- Build: `yarn workspace @vue-skuilder/standalone-ui build` (Vite production build)
- Preview: `yarn workspace @vue-skuilder/standalone-ui preview`
- Test (E2E): `yarn workspace @vue-skuilder/standalone-ui test:e2e` (Cypress)
- Test (E2E headless): `yarn workspace @vue-skuilder/standalone-ui test:e2e:headless`

## Build System
- **Framework**: Vite with shared configuration (`vite.config.base.js`)
- **Target**: ES2020 with Terser minification
- **Port**: 6173 (distinct from platform-ui's 5173)
- **Environment**: Process polyfills for browser compatibility

## Testing
- **E2E Tests**: Cypress for application flow testing
- **Test Coverage**: Authentication and smoke tests

## Dependencies

### Core Framework
- **Vue 3**: `vue` with Composition API
- **Vuetify 3**: `vuetify` with Material Design components
- **Vue Router 4**: `vue-router` for navigation
- **Pinia**: `pinia` for state management

### Vue-Skuilder Packages
- `@vue-skuilder/common-ui` - Shared UI components
- `@vue-skuilder/courses` - Course content system
- `@vue-skuilder/db` - Database layer

### Utilities
- `events` - Event emitter for component communication

## Application Structure

### Views
- **HomeView**: Landing page and course selection
- **BrowseView**: Course catalog browsing
- **StudyView**: Study session interface
- **ProgressView**: Learning progress tracking

### Components
- **CourseHeader**: Course branding and navigation
- **CourseFooter**: Course completion status

### Configuration
- **Course Config**: `skuilder.config.json` for standalone course settings
- **Composables**: `useCourseConfig.ts` for configuration management

## Key Features

### Standalone Operation
- **Self-Contained**: No dependency on platform-ui or authoring tools
- **Course-Specific**: Designed for single-course deployment
- **Minimal Interface**: Focused on learning experience

### Study Experience
- **Progress Tracking**: Visual progress indicators
- **Session Management**: Configurable study sessions
- **Content Rendering**: Full course content type support

### Configuration System
- **Course Metadata**: Title, description, branding
- **Study Settings**: Session length, review scheduling
- **UI Customization**: Theme and layout options

## Deployment Scenarios
- **Single Course**: Packaged with specific course content
- **Course Marketplace**: Multiple course selection interface
- **Embedded Widget**: Iframe-embeddable course player
- **Mobile App**: Cordova/Capacitor wrapper for native apps

## Development Notes
- **Shared Codebase**: Reuses components from `common-ui` and `courses`
- **Independent Styling**: Custom theme separate from platform-ui
- **Minimal Backend**: Can operate with static data provider only