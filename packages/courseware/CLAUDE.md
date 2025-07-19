# @vue-skuilder/courseware Package

Vue 3 component library providing specialized course content types and question implementations.

## Commands
- Build: `yarn workspace @vue-skuilder/courseware build` (Vite library build with assets)
- Dev: `yarn workspace @vue-skuilder/courseware dev` (Vite watch mode)  
- Test: `yarn workspace @vue-skuilder/courseware test` (Vitest)
- Test (watch): `yarn workspace @vue-skuilder/courseware test:watch`
- Type check: `yarn workspace @vue-skuilder/courseware type-check`

## Build System
- **Framework**: Vite with shared configuration (`vite.config.base.js`)
- **Library Mode**: ES module and CommonJS outputs
- **Asset Handling**: SVG and CSS assets included in build
- **Types**: Generated via `vite-plugin-dts`

### Package Exports
- **Main**: ES module (`./dist/index.mjs`) and CommonJS (`./dist/index.cjs.js`)
- **Types**: TypeScript definitions (`./dist/index.d.ts`)
- **Styles**: CSS bundle (`./dist/assets/index.css`)

## Testing
- **Framework**: Vitest with jsdom environment
- **Coverage**: Component and utility function testing

## Dependencies

### Core Framework (Peer Dependency)
- **Vue 3**: Required peer dependency for component system

### Vue-Skuilder Packages
- `@vue-skuilder/common` - Shared utilities and types
- `@vue-skuilder/common-ui` - Base UI components
- `@vue-skuilder/db` - Database integration

### Specialized Libraries
- **Graphics**: `paper` for 2D graphics and drawing
- **Utilities**: `lodash` for data manipulation, `moment` for dates

## Course Content Structure

### Subject Domains

#### Chess (`chess/`)
- **ChessBoard Component**: Interactive chess position display
- **Chess Engine**: Game logic and move validation (`composables/useChessEngine.ts`)
- **Question Types**: 
  - Puzzle solving (`questions/puzzle/`)
  - Tactical patterns (`questions/forks/`)
- **Chessground Integration**: Custom chess UI library

#### Music (`piano/`, `sightsing/`, `pitch/`)
- **Piano Components**: Virtual piano interface and note display
- **MIDI Integration**: Hardware MIDI device support (`utility/midi.ts`)
- **Music Theory**: Note identification, key signatures
- **Question Types**:
  - Note playback and echo (`piano/questions/echo/`)
  - Pitch identification (`pitch/questions/identify/`)
  - Sight singing (`sightsing/questions/IdentifyKey/`)

#### Mathematics (`math/`)
- **Arithmetic**: Addition, subtraction, multiplication, division
- **Geometry**: Angle categorization and measurement
- **Algebra**: One-step equations, equality testing
- **Utilities**: Fraction mathematics (`utility/Fraction.ts`)

#### Language Learning (`french/`, `word-work/`)
- **Audio Processing**: Speech recognition and audio parsing
- **Vocabulary**: Word identification and spelling
- **Anki Integration**: Flashcard generation utilities

#### Typing (`typing/`)
- **Keyboard Training**: Single letter and falling letter games
- **Progress Tracking**: Typing speed and accuracy measurement

#### Default Content (`default/`)
- **Anki Cards**: Traditional flashcard interface
- **Fill-in-the-Blank**: Cloze deletion questions with intelligent correction

## Component Architecture
- **Domain Organization**: Content grouped by subject area
- **Question Types**: Standardized question interface with `index.ts` exports
- **Vue Components**: `.vue` files for interactive content
- **Composables**: Shared logic using Vue 3 Composition API
- **Asset Management**: SVG icons and CSS styles co-located with components

## Asset Handling
The build system includes special handling for:
- **SVG Assets**: Vector graphics for chess pieces, musical notation
- **CSS Styles**: Component-specific styling
- **Audio Files**: Sound effects and musical samples (referenced, not bundled)

## Extension Points
New course content types can be added by:
1. Creating a new domain directory (e.g., `biology/`)
2. Implementing question components with standard interface
3. Exporting via domain `index.ts`
4. Adding to main package exports