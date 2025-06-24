# @vue-skuilder/platform-ui Package

Main platform UI application built with Vue 3, Vuetify, and Vite. Provides the complete course authoring and study interface.

## Commands
- Dev: `yarn workspace @vue-skuilder/platform-ui dev` (Vite dev server, port 5173)
- Build: `yarn workspace @vue-skuilder/platform-ui build` (Vite production build)
- Preview: `yarn workspace @vue-skuilder/platform-ui serve`
- Test (unit): `yarn workspace @vue-skuilder/platform-ui test:unit` (Vitest)
- Test (unit watch): `yarn workspace @vue-skuilder/platform-ui test:unit:hmr`
- Test (E2E): `yarn workspace @vue-skuilder/platform-ui test:e2e` (Cypress)
- Test (E2E headless): `yarn workspace @vue-skuilder/platform-ui test:e2e:headless`
- Lint: `yarn workspace @vue-skuilder/platform-ui lint`

## Build System
- **Framework**: Vite with shared configuration (`vite.config.base.js`)
- **Target**: ES2020 with Terser minification
- **PWA**: Progressive Web App with service worker
- **Environment**: Custom environment variable injection via `vite-env-plugin.js`

## Testing
- **Unit Tests**: Vitest with Vue Testing Library
- **E2E Tests**: Cypress with custom commands
- **Coverage**: Vitest coverage via v8 provider

## Dependencies

### Core Framework
- **Vue 3**: `vue` with Composition API
- **Vuetify 3**: `vuetify` with Material Design components
- **Vue Router 4**: `vue-router` for navigation
- **Pinia**: `pinia` for state management

### Vue-Skuilder Packages
- `@vue-skuilder/common` - Shared utilities
- `@vue-skuilder/common-ui` - Shared components
- `@vue-skuilder/courses` - Course content system
- `@vue-skuilder/db` - Database layer

### Specialized Libraries
- **Music**: `@tonaljs/tonal`, `abcjs`, `webmidi`, `wavesurfer.js`
- **Chess**: `chess.js` for chess course content
- **Audio**: Media recording and playback
- **UI/UX**: `canvas-confetti`, `mousetrap`, `lodash`

## Key Features

### Course Authoring
- **Course Editor**: Complete course creation interface (`components/Courses/CourseEditor.vue`)
- **Bulk Import**: CSV/text import with preview (`components/Edit/BulkImport/`)
- **Component Registration**: Dynamic question type registration
- **Navigation Strategy**: Configurable content progression

### Study System
- **Session Management**: Study session configuration and execution
- **Card Browser**: Content browsing and search
- **Progress Tracking**: User statistics and heat maps

### Content Types
- **Question Types**: Multiple choice, fill-in, true/false, etc.
- **Media Support**: Audio, images, MIDI, chess positions
- **Markdown Rendering**: Rich text content with code highlighting

### User Management
- **Authentication**: Login/registration system
- **Classrooms**: Multi-user course management
- **Admin Interface**: System administration tools

## PWA Configuration
- **Service Worker**: Automatic updates with Workbox
- **Offline Support**: Cached resources for offline study
- **App Manifest**: Install as native app
- **File Size Limit**: 3MB maximum for caching

## Environment Configuration
Custom environment variables injected via `ENVIRONMENT_VARS.ts` and processed by `vite-env-plugin.js`.