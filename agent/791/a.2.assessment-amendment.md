# Studio Mode Assessment Amendment

## Architectural Change: studio-ui Package

### Original Plan Issues
The original assessment proposed reusing platform-ui for studio mode, but deeper analysis reveals significant drawbacks:

**Platform-UI Bloat:**
- 60+ source files with complex routing and navigation
- Heavy branding and platform-specific text ("doors to nowhere" in studio context)
- Full application features: user registration, classrooms, study sessions, notifications
- Complex authentication and authorization systems
- Heavyweight for simple course editing workflow

### Revised Architecture: Lightweight studio-ui Package

**Core Insight:** The CourseInformation component in common-ui contains **all editing functionality** needed for studio mode while being highly self-contained.

**New Approach:**
```
studio-ui (NEW package)
├── Wraps CourseInformation component
├── Adds studio-specific features (flush button)
├── Minimal dependencies and footprint
└── Purpose-built for course editing
```

### Benefits of studio-ui Approach

**Dramatically Lighter:**
- ~10-15 files vs 60+ in platform-ui (~90% reduction)
- Focused dependencies: common-ui, courses, db, vue, vuetify, pinia
- No platform-specific bloat or unused features

**Better User Experience:**
- Clear, focused interface for course editing
- No confusing navigation or irrelevant features
- Faster startup and lower resource usage
- Purpose-built workflow for studio editing

**Development Benefits:**
- Easier to maintain and extend
- Clear separation of concerns
- Single-purpose package with obvious functionality
- Simpler testing and debugging

### Implementation Details

**studio-ui Package Structure:**
```
packages/studio-ui/
├── src/
│   ├── main.ts              # Vue app initialization with data layer
│   ├── App.vue              # Minimal wrapper around CourseInformation
│   ├── router.ts            # Basic routing (optional)
│   ├── components/
│   │   └── StudioFlush.vue  # Flush-to-static functionality
│   └── stores/
│       └── auth.ts          # Minimal auth store for CourseInformation
├── package.json             # Lightweight dependencies
├── vite.config.ts           # Shared vite config
└── index.html               # Entry point
```

**Key Components:**
- **CourseInformation**: Core editing functionality from common-ui
- **StudioFlush**: New component for pack-to-static workflow
- **Minimal routing**: Just enough for course navigation
- **Basic auth store**: Required by CourseInformation component

### Updated Integration Strategy

**CLI Integration:**
1. Launch studio-ui instead of platform-ui
2. Pass course database and connection details
3. Provide flush callback to CLI for packing workflow

**SUI Integration:**
- Add studio-ui as devDependency (much lighter than platform-ui)
- Maintain familiar `yarn studio` workflow
- Studio-ui handles editing, CLI handles infrastructure

### Comparison: Old vs New

| Aspect | Platform-UI Approach | Studio-UI Approach |
|--------|---------------------|-------------------|
| Package Size | 60+ files, complex | 10-15 files, focused |
| Dependencies | Heavy, full platform | Light, editing-focused |
| User Experience | Confusing, many unused features | Clear, purpose-built |
| Maintenance | Complex, multi-purpose | Simple, single-purpose |
| Startup Time | Slow, heavy loading | Fast, minimal loading |
| Development | Platform concerns mixed in | Clean separation |

## Recommendation: Proceed with studio-ui

The studio-ui approach is superior in every metric. It provides the same editing capabilities with dramatically better UX, performance, and maintainability.

This change requires updating the todo to include studio-ui package creation and integration, while removing platform-ui launch complexity.