# Assessment: Interactive Hero Section for Vue-Skuilder Docs

## Current State Analysis

### Hero Section Structure
- **Location**: `docs/index.md` (VitePress home layout)
- **Current elements**: 
  - Hero name: "vue-skuilder" 
  - Hero text: "tools for `SRS++` and interactive tutoring systems"
  - Tagline: "Portable courseware for composable curricula"
  - Three action buttons (Tell me more!, Quickstart, GitHub)
  - Features section below hero

### Component Import System
- **Working example**: `docs/cards.md:6-8` successfully imports and renders Vue components
- **Import pattern**: `@vue-skuilder/courseware/typing/questions/falling-letters/FallingLetters.vue`
- **Monorepo aliases**: Configured in `docs/.vitepress/config.mts:9-12`

### Target Components for Demo
1. **StudySession.vue** (`packages/common-ui/src/components/StudySession.vue`)
   - Main study loop component
   - Complex with user/database dependencies
   - 600+ lines, requires significant props
   
2. **SessionConfiguration.vue** (`packages/platform-ui/src/components/Study/SessionConfiguration.vue`)
   - Study session setup UI
   - Cleaner interface, fewer dependencies
   - Course/classroom selection + time configuration

## Implementation Options

### Option A: Embed SessionConfiguration Demo
**Pros:**
- Cleaner component with less complex state
- Demonstrates core UX flow (setup → study)
- More self-contained UI

**Cons:**
- Shows setup, not actual study experience
- Still has database/user dependencies

### Option B: Create Simplified Study Demo Component
**Pros:**
- Can showcase actual study mechanics
- Controllable demo data
- No real dependencies

**Cons:**
- Requires creating new component
- More development work

### Option C: Use FallingLetters + Wrapper
**Pros:**
- Already working in docs (per cards.md)
- Showcases interactive courseware capability
- Minimal dependencies

**Cons:**
- Only shows one question type
- Less representative of full platform

## Layout Modifications Required

### Hero Layout Changes
- **Current**: Full-width hero with centered content
- **Target**: Split layout - text on left, interactive demo on right
- **Edit points**:
  - `docs/index.md` - Hero configuration
  - `docs/.vitepress/theme/style.css` - Hero layout overrides
  - Custom CSS for split-screen desktop layout

### VitePress Home Layout Customization
- **Location**: `docs/.vitepress/theme/index.ts:9-12` (Layout slots)
- **Approach**: Use `home-hero-after` or `home-features-before` slot
- **Alternative**: Override hero layout with custom component

### Responsive Considerations
- Desktop: Side-by-side hero text + demo component
- Mobile: Stacked layout (text above, demo below)
- Maintain existing features section below

## Technical Dependencies

### VitePress Configuration
- **Component imports**: Already configured via aliases in `config.mts`
- **Vue component support**: Built-in via Vite plugin
- **SSR compatibility**: Need to ensure demo component is SSR-safe

### Component Dependencies Analysis
```typescript
// StudySession.vue requires:
- UserDBInterface 
- DataLayerProvider
- SessionController
- Multiple database connections

// SessionConfiguration.vue requires:
- User authentication
- Course/classroom data
- Database layer access
```

## Recommendation

**Create Option B: Simplified Study Demo Component**

### Rationale:
1. **Best showcase value**: Demonstrates actual study mechanics rather than just setup
2. **Controllable**: Can use mock data to show ideal state
3. **Representative**: Shows core value prop of the platform
4. **Maintainable**: Self-contained for docs environment

### Implementation approach:
1. Create `docs/.vitepress/theme/components/StudyDemo.vue`
2. Use mock data to simulate study session
3. Include simplified card rendering and response mechanics
4. Focus on visual demonstration of SRS++ concepts

### Layout strategy:
- Split hero on desktop (60% text, 40% demo)
- Stack on mobile (text above, demo below)
- Use VitePress layout slots for insertion
- Preserve existing features section

This approach balances technical feasibility with maximum demonstration value while maintaining the existing page structure and user experience.