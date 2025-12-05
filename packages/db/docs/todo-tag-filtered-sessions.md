# TODO: Tag-Filtered Study Sessions

## Status: IN PROGRESS

## Overview

Enable ephemeral, tag-scoped study sessions where users can focus on specific topics within a course. A musician studying music theory could practice "only C Major scales" without permanently configuring the course.

Sessions can include multiple courses, each with its own tag filter configuration.

## Prior Art

PR #982 (unmerged) sketched this feature:
- `TagFilteredContentSource` class wrapping tag resolution logic
- `SessionTagFilter.vue` UI component for tag selection
- Pinia store for carrying config between views

This TODO resurrects that approach with UI integration into existing `SessionConfiguration.vue`.

## Design

### TagFilter Interface

Simple include/exclude model (OR for includes, AND NOT for excludes):

```typescript
interface TagFilter {
  include: string[];  // Cards must have at least one of these tags
  exclude: string[];  // Cards must not have any of these tags
}

// Per-course configuration for a session
interface CourseSessionConfig {
  courseId: string;
  tagFilter?: TagFilter;  // undefined = no filtering (all cards)
}
```

Example: `{ include: ['scales', 'arpeggios'], exclude: ['advanced'] }`
→ Cards with (scales OR arpeggios) AND NOT advanced

### TagFilteredContentSource

A `StudyContentSource` implementation that:

1. Resolves `TagFilter` to a set of eligible card IDs
2. Returns new cards from that set (excluding already-active cards)
3. Filters pending reviews to only in-scope cards

```typescript
class TagFilteredContentSource implements StudyContentSource {
  constructor(courseId: string, filter: TagFilter, user: UserDBInterface);
  
  getNewCards(): Promise<StudySessionNewItem[]>;
  getPendingReviews(): Promise<StudySessionReviewItem[]>;
  getWeightedCards(limit: number): Promise<WeightedCard[]>;
}
```

### UI Flow

Integration into existing `SessionConfiguration.vue` (platform-ui):

1. User sees course list with checkboxes (existing)
2. When a course is selected, a "Customize" button/expander appears
3. Clicking "Customize" reveals tag filter controls for that course:
   - Multi-select for "Include tags" (populated from course tags)
   - Multi-select for "Exclude tags"
4. User can configure multiple courses with different tag filters
5. "Start!" button collects all configurations and starts session
6. Each course creates either:
   - Regular `CourseDB` source (no filter)
   - `TagFilteredContentSource` (with filter)

### Data Flow

```
SessionConfiguration.vue
  └── activeCourses: (CourseRegistration & SessionConfigMetaData & { tagFilter?: TagFilter })[]
        │
        ▼
  startSession()
        │
        ▼
  For each selected course:
    - If tagFilter defined → create TagFilteredContentSource
    - If no tagFilter → create regular course source
        │
        ▼
  SessionController receives mixed source array
```

## Implementation Steps

### Step 1: Create TagFilter Types ✅

- [x] Create `packages/common/src/interfaces/TagFilter.ts`
- [x] Define `TagFilter` interface
- [x] Add `emptyTagFilter()` helper function
- [x] Add `hasActiveFilter()` helper function
- [x] Export from `packages/common/src/interfaces/index.ts`

Note: `CourseSessionConfig` deferred - will be defined inline in `SessionConfiguration.vue` metadata.

### Step 2: Create TagFilteredContentSource ✅

Resurrect from PR #982 with updates:

- [x] Create `packages/db/src/study/TagFilteredContentSource.ts`
- [x] Implement `resolveFilteredCardIds()` using `getTag()`
- [x] Implement `getNewCards()` - filter to eligible, exclude active
- [x] Implement `getPendingReviews()` - filter reviews to eligible cards
- [x] Implement `getWeightedCards()` - wrap legacy methods with score=1.0
- [x] Export from `packages/db/src/study/index.ts` (which re-exports via `packages/db/src/index.ts`)

Features implemented:
- Caches resolved card IDs for session efficiency
- Reviews prioritized over new cards in `getWeightedCards()`
- Provenance tracking for debugging
- `clearCache()` method if tag data changes mid-session

### Step 3: Create CourseTagFilterWidget Component

Inline widget for tag filter configuration (not a full-page component):

- [ ] Create `packages/common-ui/src/components/CourseTagFilterWidget.vue`
- [ ] Props: `courseId: string`, `modelValue: TagFilter | undefined`
- [ ] Emits: `update:modelValue`
- [ ] Fetches course tags on mount via `getCourseTagStubs()`
- [ ] Two `v-select` components for include/exclude
- [ ] Compact design suitable for embedding in course row
- [ ] Export from `packages/common-ui/src/index.ts`

### Step 4: Modify SessionConfiguration.vue

Update existing component to support per-course tag filtering:

- [ ] Add `tagFilter?: TagFilter` to `SessionConfigMetaData` interface
- [ ] Add "Customize" button/expander per course row
- [ ] Embed `CourseTagFilterWidget` in expanded state
- [ ] Update `startSession()` to build mixed source array:

```typescript
startSession() {
  const sources: StudyContentSource[] = [];
  
  for (const course of this.activeCourses.filter(c => c.selected)) {
    if (course.tagFilter && course.tagFilter.include.length > 0) {
      sources.push(new TagFilteredContentSource(
        course.courseID,
        course.tagFilter,
        this.user!
      ));
    } else {
      sources.push({ type: 'course', id: course.courseID });
    }
  }
  
  // ... emit with sources
}
```

### Step 5: Update ContentSourceID Handling

The current flow uses `ContentSourceID` objects that get resolved later.
We need to either:

**Option A**: Extend `ContentSourceID` to carry optional `tagFilter`:
```typescript
interface ContentSourceID {
  type: 'course' | 'classroom' | 'tag-filtered';
  id: string;
  tagFilter?: TagFilter;
}
```

**Option B**: Resolve sources in `SessionConfiguration.vue` and pass actual `StudyContentSource[]`:
- Requires changing `initStudySession` event signature
- More explicit but larger change

- [ ] Decide on approach and implement

### Step 6: Integration Testing

- [ ] Test session with single filtered course
- [ ] Test session with multiple courses (mixed filtered/unfiltered)
- [ ] Test session with classroom + filtered course
- [ ] Verify reviews are properly scoped

## Files to Create

| File | Purpose |
|------|---------|
| `packages/common/src/types/tagFilter.ts` | TagFilter type definitions |
| `packages/db/src/study/TagFilteredContentSource.ts` | Core filtering logic |
| `packages/common-ui/src/components/CourseTagFilterWidget.vue` | Inline tag filter UI |

## Files to Modify

| File | Change |
|------|--------|
| `packages/common/src/index.ts` | Export TagFilter types |
| `packages/db/src/index.ts` | Export TagFilteredContentSource |
| `packages/common-ui/src/index.ts` | Export CourseTagFilterWidget |
| `packages/platform-ui/src/components/Study/SessionConfiguration.vue` | Add per-course tag filter UI |
| `packages/db/src/core/interfaces/contentSource.ts` | Possibly extend ContentSourceID |

## UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│ Study Session Setup                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Select Quilts to Study                 │ Session Settings   │
│                                        │                    │
│ ☑ Select All                  Reviews  │ Time Limit         │
│ ───────────────────────────────────────│ [5] minutes        │
│ ☑ q/Music Theory                  12   │                    │
│   └─ [Customize ▼]                     │ [  Start!  ]       │
│      ┌────────────────────────────┐    │                    │
│      │ Include: [C Major] [Scales]│    │                    │
│      │ Exclude: [Advanced]        │    │                    │
│      └────────────────────────────┘    │                    │
│ ☑ q/French Vocabulary              8   │                    │
│ ☐ q/Chemistry                      3   │                    │
│                                        │                    │
└─────────────────────────────────────────────────────────────┘
```

## Future Enhancements (Out of Scope)

These are documented for later consideration but NOT part of this task:

- **Boolean algebra**: Full expression trees like `(tagX OR tagY) AND tagZ`
- **Prerequisite expansion**: Auto-include prerequisite tags when filtering
- **Universe-based pipeline**: Integrate with `Pipeline` architecture for proper scoring
- **Course-defined practice modes**: Let course authors define preset filtered sessions
- **URL serialization**: Deep-linkable filtered sessions via query params
- **Standalone-ui integration**: Similar UI pattern for standalone app

## Testing Notes

- Verify empty include list = no filtering (not "exclude all")
- Verify cards with multiple tags are handled correctly
- Verify reviews outside scope are excluded
- Verify session works normally after filter applied
- Verify mixed filtered/unfiltered sources work together

## Related Documents

- `navigators-architecture.md` - Pipeline architecture (future integration point)
- `todo-pipeline-optimization.md` - Batch tag hydration (useful for filtering)