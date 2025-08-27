# Plan: Functional Study Session in Hero Section

## Revised Understanding

- **Goal**: Embed a real, functional study session using `StaticDataLayerProvider`
- **Data**: Bundle static course assets with the docs site
- **Component**: Full StudySession functionality, not a simplified demo
- **Layout**: Split hero on desktop (text left, interactive session right)
- **Technical**: Use existing `static` mode from `packages/db/src/factory.ts`

## Implementation Strategy

### 1. Static Data Layer Integration

**Location**: `docs/.vitepress/theme/composables/useStaticDataLayer.ts`
- Initialize `StaticDataLayerProvider` with bundled course data
- Handle async initialization in VitePress context
- Export composable for component usage

**Course Data Bundle**:
- Create `docs/public/static-courses/` directory
- Include sample course JSON manifests
- Bundle with docs build process

### 2. Hero Layout Modifications

**VitePress Home Layout Override**:
- **File**: `docs/.vitepress/theme/components/CustomHomeLayout.vue`
- **Approach**: Override default home layout entirely
- **Sections**: Hero split, Features preserved

**Hero Split Implementation**:
```vue
<div class="hero-container">
  <div class="hero-text">
    <!-- Existing hero content -->
  </div>
  <div class="hero-study-session">
    <StudySessionWrapper />
  </div>
</div>
```

### 3. Study Session Wrapper Component

**Location**: `docs/.vitepress/theme/components/StudySessionWrapper.vue`
- Initialize static data layer
- Handle component lifecycle in docs context
- Wrap StudySession/SessionConfiguration appropriately
- Error boundaries for docs environment

### 4. Layout Integration Points

**Hero Layout CSS** (`docs/.vitepress/theme/style.css`):
- Override VitePress home hero styles
- Implement responsive grid layout
- Desktop: 60/40 split (text/session)
- Mobile: Stacked layout

**Component Integration** (`docs/.vitepress/theme/index.ts`):
- Register StudySessionWrapper globally
- Override Layout with custom home layout
- Handle SSR compatibility

## Edit Points Identified

### Core Files to Modify:

1. **`docs/index.md`**: 
   - Remove or adjust hero configuration
   - May need custom frontmatter for layout override

2. **`docs/.vitepress/theme/index.ts`**:
   - Import and register StudySessionWrapper
   - Override Layout component for home page

3. **`docs/.vitepress/theme/style.css`**:
   - Hero layout overrides (lines ~98-119)
   - New responsive grid styles
   - Maintain existing gradient background

4. **`docs/.vitepress/config.mts`**:
   - Ensure proper aliases for all required packages
   - May need additional Vite config for static assets

### New Files to Create:

1. **`docs/.vitepress/theme/components/CustomHomeLayout.vue`**
   - Complete home layout override
   - Split hero implementation

2. **`docs/.vitepress/theme/components/StudySessionWrapper.vue`**
   - Data layer initialization
   - Study session integration

3. **`docs/.vitepress/theme/composables/useStaticDataLayer.ts`**
   - Static data layer setup
   - Async initialization handling

4. **`docs/public/static-courses/`** (directory + files)
   - Sample course data
   - Course manifests
   - Static assets

## Responsive Design Strategy

### Desktop Layout (≥960px):
```css
.hero-container {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 2rem;
  align-items: center;
}
```

### Mobile Layout (<960px):
```css
.hero-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
```

## Technical Considerations

### SSR Compatibility:
- Static data layer initialization on client-side only
- Loading states for hydration
- Graceful fallbacks

### VitePress Integration:
- Preserve existing theme capabilities
- Maintain hot-reload functionality
- Handle build-time asset bundling

### Performance:
- Lazy-load study session component
- Optimize static course data size
- Cache strategy for repeated visits

## Next Steps

1. **Phase 1**: Create static data layer infrastructure
2. **Phase 2**: Build StudySessionWrapper with mock data
3. **Phase 3**: Implement custom home layout
4. **Phase 4**: Style and responsive implementation
5. **Phase 5**: Integration testing and refinement

This approach leverages the existing static data capability while creating a compelling, functional demonstration directly in the documentation hero section.