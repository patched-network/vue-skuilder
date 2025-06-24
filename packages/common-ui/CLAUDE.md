# @vue-skuilder/common-ui Package

Shared Vue 3 component library providing reusable UI components across vue-skuilder applications.

## Commands
- Build: `yarn workspace @vue-skuilder/common-ui build` (Vite library build + types)
- Dev: `yarn workspace @vue-skuilder/common-ui dev` (Vite watch mode)
- Test (unit): `yarn workspace @vue-skuilder/common-ui test:unit` (Vitest)
- Test (component): `yarn workspace @vue-skuilder/common-ui cypress:open` (Cypress component testing)
- Test (component CI): `yarn workspace @vue-skuilder/common-ui cypress:run`
- Lint: `yarn workspace @vue-skuilder/common-ui lint`

## Build System
- **Framework**: Vite with shared configuration (`vite.config.base.js`)
- **Library Mode**: UMD and ES module outputs
- **CSS Handling**: Separate CSS bundle with code splitting
- **Types**: Generated via TypeScript compiler

### Package Exports
- **Main**: UMD build (`./dist/common-ui.umd.js`)
- **Module**: ES build (`./dist/common-ui.es.js`)
- **Types**: TypeScript definitions (`./dist/index.d.ts`)
- **Styles**: CSS bundle (`./dist/assets/index.css`)

## Testing
- **Unit Tests**: Vitest with Vue Testing Library and jsdom
- **Component Tests**: Cypress component testing for integration
- **Coverage**: Full component interaction testing

## Dependencies

### Core Framework (Peer Dependencies)
- **Vue 3**: Required peer dependency
- **Vue Router 4**: Required for navigation components
- **Vuetify 3**: Required for Material Design components

### Vue-Skuilder Packages
- `@vue-skuilder/common` - Shared utilities
- `@vue-skuilder/db` - Database integration

### Specialized Libraries
- **UI Components**: `@vojtechlanka/vue-tags-input` for tag input
- **Content Rendering**: `marked` for markdown, `highlight.js` for syntax highlighting
- **Interaction**: `mousetrap` for keyboard shortcuts
- **State**: `pinia` for component-level state management

## Component Categories

### Core UI Components
- **CardBrowser**: Paginated content browsing with search
- **CourseCardBrowser**: Course-specific card navigation
- **CourseInformation**: Course metadata display and editing
- **PaginatingToolbar**: Pagination controls with jump-to functionality

### Study Components
- **StudySession**: Complete study session management
- **StudySessionTimer**: Session timing and progress tracking
- **HeatMap**: Progress visualization with calendar layout

### Content Rendering
- **MarkdownRenderer**: Markdown content with syntax highlighting
- **CodeBlockRenderer**: Code syntax highlighting
- **AudioAutoPlayer**: Automatic audio playback management
- **CardViewer**: Universal card content display

### User Interface
- **SnackbarService**: Global notification system
- **TagsInput**: Tag management interface
- **UserChip**: User avatar and information display

### Input Components
- **BaseUserInput**: Abstract base for all input types
- **RadioMultipleChoice**: Multiple choice question interface
- **TrueFalse**: Boolean question interface
- **UserInputString/Number**: Text and numeric inputs
- **fillInInput**: Cloze/fill-in-the-blank questions

### Interaction Components
- **SkMouseTrap**: Keyboard shortcut management
- **SkMouseTrapToolTip**: Keyboard hint overlays

## Design Patterns
- **Composition API**: All components use Vue 3 Composition API
- **TypeScript**: Full type safety with `.types.ts` pattern for complex props
- **Composables**: Shared logic in `composables/` directory
- **Store Integration**: Pinia stores for cross-component state
- **Accessibility**: ARIA labels and keyboard navigation support

## External Dependencies
The library externalizes framework dependencies to avoid duplication:
- `vue`, `vue-router`, `vuetify`, `pinia` are peer dependencies
- Components expect these to be provided by the consuming application