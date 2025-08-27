# Refined Assessment: StudySession Integration for Docs Hero Section

## Understanding the Revised Requirements

### Key Realizations
1. **Static Site Context**: VitePress docs are statically generated, so we need a fully self-contained solution
2. **Real StudySession**: User wants actual `StudySession.vue` functionality, not a simplified demo
3. **Static Data Layer**: Leverage existing `StaticDataLayerProvider` from `@vue-skuilder/db` 
4. **Bundle Strategy**: Course data should be bundled with docs build into `public/` folder
5. **Forward-Looking**: Build reusable infrastructure for embedding real courses throughout docs

### Inspiration Sources Analyzed

#### `packages/standalone-ui/src/views/StudyView.vue`
**Key patterns identified:**
- Simple wrapper around `StudySession` component (lines 6-14)
- Uses `getDataLayer()` factory pattern (line 35)
- Minimal props: `contentSources`, `sessionTimeLimit`, `user`, `dataLayer`, `getViewComponent`
- Environment-based course ID configuration (lines 50-63)
- Loading state handling during session preparation (lines 16-21)

#### `docs/cards.md` Component Import Pattern
**Working example:** 
```vue
<script setup lang="ts">
import FallingLetters from '@vue-skuilder/courseware/typing/questions/falling-letters/FallingLetters.vue'
</script>

<FallingLetters :data="[{ gameLength: 30, initialSpeed: 1, acceleration: 0.2, spawnInterval: 1 }]" />
```
This proves VitePress can successfully import and render complex Vue components from the monorepo.

#### `StaticDataLayerProvider` Examination
**Location**: `packages/db/src/impl/static/StaticDataLayerProvider.ts`
- Designed for environments without CouchDB backend
- Accepts pre-built course manifests and JSON data
- Perfect fit for static site deployment
- **Key insight**: Line 63-64 shows `BaseUser.Dummy()` creates a user with sync strategy - this enables browser localStorage persistence

#### `CustomVPHero.vue` Layout (Existing)
Hero layout is already settled and implemented. No need to worry about hero text balance or split implementation details.

## Refined Technical Approach

### 1. Data Strategy: Demo Course Content

**Demo Course Theme**: "Is Vue-Skuilder Cool?" with multiple question types:

**Bundle Location**: `docs/public/static-courses/`
```
docs/public/static-courses/
├── demo-course/
│   ├── manifest.json
│   ├── cards/
│   │   ├── is-skuilder-cool.json      // Basic yes/no question
│   │   ├── platform-features.json     // Multiple choice
│   │   ├── srs-concepts.json          // Fill-in-the-blank
│   │   └── future-singing.json        // Placeholder for mic-based Q
│   └── assets/
│       └── [any-media-files]
├── library-internals/                  // Future: Real courses about using vue-skuilder
│   ├── component-api.json
│   └── data-layer-guide.json
└── index.json  // Course registry
```

**Sample Card Structure** (tongue-in-cheek + educational):
```json
{
  "cardID": "is-skuilder-cool-001",
  "data": [
    {
      "question": "Is Vue-Skuilder the coolest spaced repetition system you've ever seen?",
      "options": ["Yes", "Obviously yes", "Definitely yes", "No (but I'm wrong)"]
    }
  ],
  "tags": ["demo", "meta"],
  "elo": 1000,
  "viewID": "multiple-choice"
}
```

### 2. Component Architecture: Reusable Embedded Course System

**Primary Component**: `EmbeddedCourse.vue` (not just for hero)
- Reusable throughout docs for any bundled course
- Full persistence via `StaticDataLayerProvider` + browser localStorage
- Error boundaries with console logging + graceful hiding

**Hero-Specific Wrapper**: `HeroStudySession.vue`
- Thin wrapper around `EmbeddedCourse`
- Hero-specific styling and constraints
- Integrates with `CustomVPHero.vue`

```vue
<!-- docs/.vitepress/theme/components/EmbeddedCourse.vue -->
<template>
  <div v-if="error" class="error-state" style="display: none;">
    <!-- Hidden but logs to console -->
  </div>
  <div v-else-if="sessionPrepared" class="study-container">
    <StudySession
      :content-sources="contentSources" 
      :session-time-limit="sessionTimeLimit"
      :user="user"
      :data-layer="dataLayer"
      :session-config="sessionConfig"
      :get-view-component="getViewComponent"
      @session-finished="handleSessionFinished"
    />
  </div>
  <div v-else class="loading-state">
    <span>Loading course...</span>
  </div>
</template>
```

### 3. Data Layer with Persistence Strategy

**Browser localStorage integration** via `StaticDataLayerProvider`:
- User progress stored locally via `BaseUser.Dummy()` sync strategy
- ELO updates, review scheduling, card history all persist
- Multiple course support for future library documentation courses

**Composable Pattern**:
```typescript
// docs/.vitepress/theme/composables/useStaticDataLayer.ts
export function useStaticDataLayer(courseIds: string[] = ['demo-course']) {
  const dataLayer = ref<DataLayerProvider | null>(null);
  const error = ref<Error | null>(null);
  
  const initialize = async () => {
    try {
      const manifests = await fetch('/static-courses/index.json').then(r => r.json());
      const config: DataLayerConfig = {
        type: 'static',
        options: {
          staticContentPath: '/static-courses',
          localStoragePrefix: 'docs-skuilder', // Browser localStorage key
          manifests,
          COURSE_IDS: courseIds
        }
      };
      dataLayer.value = await initializeDataLayer(config);
    } catch (e) {
      error.value = e as Error;
      console.error('[useStaticDataLayer] Failed to initialize:', e);
    }
  };
  
  return { dataLayer, error, initialize };
}
```

### 4. Future-Proofing: Real Library Courses

**Vision**: Beyond hero demo, embed real educational courses about vue-skuilder itself:
- "Understanding the Data Layer API" course in API docs
- "Building Custom Question Types" in courseware docs  
- "Deployment Strategies" in deployment guides

**Reusable Pattern**:
```vue
<!-- In any docs page -->
<script setup>
import { EmbeddedCourse } from '../.vitepress/theme/components/EmbeddedCourse.vue'
</script>

## Data Layer Concepts

Learn by doing with this interactive course:

<EmbeddedCourse course-id="data-layer-guide" :session-time-limit="10" />
```

## Implementation Plan Refinement

### Phase 1: Core Infrastructure
1. **Create `useStaticDataLayer.ts` composable** with localStorage persistence
2. **Build demo course data** with "Is Skuilder Cool?" theme
3. **Create `EmbeddedCourse.vue`** as reusable component
4. **Error handling** with console logging + graceful hiding

### Phase 2: Hero Integration
1. **Create `HeroStudySession.vue`** wrapper
2. **Integrate with existing `CustomVPHero.vue`**
3. **Test full study loop** with persistence

### Phase 3: Future Expansion Framework
1. **Document usage pattern** for embedding courses in docs
2. **Create sample library internals course**
3. **Test multi-course scenarios**

### Phase 4: Advanced Question Types
1. **Placeholder for mic-based singing exercise**
2. **Custom question type infrastructure**
3. **Demo platform flexibility**

## Error Handling Strategy

**Graceful Degradation**:
- Console error logging for debugging
- Hide demo section on failure (don't break docs)
- Loading states during async initialization
- Fallback to static text if data layer fails

## Technical Dependencies Verified

✅ **VitePress component imports**: Working (per `cards.md`)  
✅ **Monorepo aliases**: Configured in `docs/.vitepress/config.mts`  
✅ **StudySession component**: Exists in `@vue-skuilder/common-ui`  
✅ **Static data layer**: Available in `@vue-skuilder/db`  
✅ **Courseware system**: Available in `@vue-skuilder/courseware`  

This approach leverages proven patterns from `standalone-ui` while adapting to the static docs context.