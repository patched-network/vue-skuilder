# TODO: NavigationStrategy UI Forms

## Status: READY TO START

## Goal

Extend `NavigationStrategyEditor.vue` to support creating all strategy types (not just HARDCODED), with user-friendly forms that support bulk text input.

---

## Phase 1: Foundation & Refactoring - COMPLETED

### P1.1: Extract Hardcoded Strategy Form - COMPLETED
- [x] Create `HardcodedOrderConfigForm.vue`
  - Extract existing cardId input logic from NavigationStrategyEditor.vue
  - Accept cardIds as bulk text (newline or comma-separated)
  - Props: `modelValue` (config object), emits `update:modelValue`
- [x] Test that hardcoded strategy creation still works

### P1.2: Add Strategy Type Selector to Editor - COMPLETED
- [x] Modify `NavigationStrategyEditor.vue`
  - Add strategy type dropdown (hardcoded, hierarchy, interference, relativePriority)
  - Conditionally render form component based on selected type
  - Update `saveNewStrategy()` to handle all strategy types
- [x] Test type switching in dialog

**Implementation Notes:**
- Created HardcodedOrderConfigForm.vue with v-model pattern
- Config format: `{ cardIds: string[] }`
- Added validation with card count display
- Modified NavigationStrategyEditor to:
  - Import HardcodedOrderConfigForm
  - Add strategyTypes dropdown data
  - Update newStrategy structure: `{ type, name, description, config }`
  - Map strategy types to Navigators enum values
  - Serialize configs appropriately (array for hardcoded, object for others)

---

## Phase 2: Hierarchy Strategy Form

### P2.1: Create HierarchyConfigForm Component
- [ ] Create `HierarchyConfigForm.vue`
  - Props: `modelValue` (HierarchyConfig), `courseId` (for tag fetching)
  - Emits: `update:modelValue`
  - Fetch available tags from course
- [ ] Implement prerequisite builder UI
  - Add prerequisite button (select tag, then add prerequisites for it)
  - For each prerequisite entry:
    - Tag selector (from course tags)
    - Optional mastery thresholds (minElo, minCount)
  - Remove prerequisite button
- [ ] Add bulk text input support
  - Text area for JSON paste (with validation preview)
  - Convert between UI state and JSON representation
- [ ] Add delegate strategy selector
- [ ] Validate config using `HierarchyDefinitionNavigator.parseConfig()`
  - Test with valid and invalid configs
  - Show validation errors in UI

### P2.2: Test Hierarchy Strategy Creation
- [ ] Create a hierarchy strategy via UI
- [ ] Verify it saves to database correctly
- [ ] Verify it loads back into the editor (when editing is implemented)

---

## Phase 3: Interference Strategy Form

### P3.1: Create InterferenceConfigForm Component
- [ ] Create `InterferenceConfigForm.vue`
  - Props: `modelValue` (InterferenceConfig), `courseId`
  - Emits: `update:modelValue`
  - Fetch available tags from course
- [ ] Implement interference group builder UI
  - Add group button
  - For each group:
    - Tag multi-selector (tags that interfere with each other)
    - Decay slider (0-1, default 0.8)
  - Remove group button
- [ ] Add maturity threshold inputs
  - minCount (default 10)
  - minElo (optional)
  - minElapsedDays (default 3)
- [ ] Add bulk text input support
  - JSON paste area with preview
- [ ] Add delegate strategy selector
- [ ] Add defaultDecay slider
- [ ] Validate config using `InterferenceMitigatorNavigator.parseConfig()`
  - Test with valid and invalid configs
  - Show validation errors

### P3.2: Test Interference Strategy Creation
- [ ] Create an interference strategy via UI
- [ ] Verify database persistence
- [ ] Verify config round-trips correctly

---

## Phase 4: RelativePriority Strategy Form

### P4.1: Create RelativePriorityConfigForm Component
- [ ] Create `RelativePriorityConfigForm.vue`
  - Props: `modelValue` (RelativePriorityConfig), `courseId`
  - Emits: `update:modelValue`
  - Fetch available tags from course
- [ ] Implement tag priority list UI
  - List all course tags
  - Priority slider (0-1) for each tag
  - Default: 0.5 (neutral)
- [ ] Add bulk text input support
  - JSON paste area
  - CSV format support? (tag,priority pairs)
- [ ] Add configuration inputs
  - defaultPriority slider (0-1)
  - combineMode selector (max/average/min)
  - priorityInfluence slider (0-1)
- [ ] Add delegate strategy selector
- [ ] Validate config using `RelativePriorityNavigator.parseConfig()`
  - Test with valid and invalid configs
  - Show validation errors

### P4.2: Test RelativePriority Strategy Creation
- [ ] Create a relativePriority strategy via UI
- [ ] Verify database persistence
- [ ] Verify config round-trips correctly

---

## Phase 5: Polish & Testing

### P5.1: Validation Enhancements
- [ ] Review navigator parseConfig methods for strictness
- [ ] Add informative error messages where parsers are too permissive
- [ ] Consider extracting validation helpers if duplication emerges

### P5.2: UX Improvements
- [ ] Add tooltips explaining each field
- [ ] Add example configs (expandable help text)
- [ ] Add config preview (show serialized JSON before save)
- [ ] Add validation summary (list all errors/warnings)

### P5.3: Integration Testing
- [ ] Test all four strategy types in studio-ui
- [ ] Test switching between strategy types in create dialog
- [ ] Verify backwards compatibility with existing HARDCODED strategies
- [ ] Test with real course data (multiple tags)

---

## Implementation Notes

### Bulk Text Input Pattern

Each form should support two input modes:
1. **Guided UI**: Buttons, selectors, sliders (primary mode)
2. **Bulk JSON**: Paste JSON, validate, sync to UI (power user mode)

Implementation:
- Add tab/toggle to switch between modes
- In JSON mode: `v-textarea` with `@input` validation
- Parse JSON → update form state
- Form state changes → update JSON preview

### Validation Pattern

Use existing navigator parseConfig methods:
```typescript
// In each form component
import HierarchyDefinitionNavigator from '@vue-skuilder/db/src/core/navigators/hierarchyDefinition';

function validateConfig() {
  try {
    const serialized = JSON.stringify(configState.value);
    const parsed = HierarchyDefinitionNavigator.prototype.parseConfig.call({}, serialized);
    // If no throw, config is valid
    errors.value = [];
    return true;
  } catch (error) {
    errors.value = [error.message];
    return false;
  }
}
```

Note: We're calling parseConfig without full navigator instantiation. If this proves insufficient, we can add static validation methods to navigators.

### Tag Fetching

All forms need course tags. Shared pattern:
```typescript
import { getDataLayer } from '@vue-skuilder/db';

async function loadCourseTags() {
  const dataLayer = getDataLayer();
  const courseDB = dataLayer.getCourseDB(props.courseId);
  const tags = await courseDB.getAllTags();
  availableTags.value = tags.rows.map(row => row.key);
}
```

### Delegate Strategy Selector

All forms need this. Consider extracting to shared component:
```vue
<delegate-strategy-selector
  v-model="config.delegateStrategy"
  :available-strategies="['elo', 'srs', 'hardcoded']"
/>
```

---

## Files Modified/Created

### New Files
```
packages/edit-ui/src/components/NavigationStrategy/
├── HardcodedOrderConfigForm.vue        (~150 LOC)
├── HierarchyConfigForm.vue             (~250 LOC)
├── InterferenceConfigForm.vue          (~300 LOC)
└── RelativePriorityConfigForm.vue      (~220 LOC)
```

### Modified Files
```
packages/edit-ui/src/components/NavigationStrategy/
└── NavigationStrategyEditor.vue        (~100 LOC added)
```

---

## Testing Checklist

- [ ] All strategy types can be created via UI
- [ ] Validation catches invalid configs
- [ ] Bulk JSON input works for all forms
- [ ] Tag selectors populate from course
- [ ] Delegate strategy selector works
- [ ] Configs save to database correctly
- [ ] Backwards compatibility with existing HARDCODED strategies
- [ ] UI is responsive and doesn't break on small screens
- [ ] Error messages are clear and actionable
