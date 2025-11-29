# TODO: NavigationStrategy UI Forms

## Status: COMPLETED ✅

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

## Phase 2: Hierarchy Strategy Form - COMPLETED

### P2.1: Create HierarchyConfigForm Component - COMPLETED
- [x] Create `HierarchyConfigForm.vue`
  - Props: `modelValue` (HierarchyConfig), `courseId` (for tag fetching)
  - Emits: `update:modelValue`
  - Fetch available tags from course
- [x] Implement prerequisite builder UI
  - Add prerequisite button (select tag, then add prerequisites for it)
  - For each prerequisite entry:
    - Tag selector (from course tags)
    - Optional mastery thresholds (minElo, minCount)
  - Remove prerequisite button
- [x] Add bulk text input support
  - Text area for JSON paste (with validation preview)
  - Convert between UI state and JSON representation
  - Dual mode tabs: Visual Editor / JSON Editor
- [x] Add delegate strategy selector
- [x] Validate config
  - Basic validation (prerequisites must be object, circular dependency check)
  - Show validation errors in UI

### P2.2: Test Hierarchy Strategy Creation - COMPLETED
- [x] Create a hierarchy strategy via UI
- [x] Verify it saves to database correctly
- [x] Verify it loads back into the editor - IMPLEMENTED

### P2.3: Strategy Editing - COMPLETED
- [x] Implement edit functionality
  - Parse existing strategy data back to config format
  - Populate dialog with existing strategy details
  - Handle update vs create in save method
  - Update dialog title and button text based on mode

**Testing Notes:**
- Visual UI mode working - tags load, prerequisite rules can be added/removed
- JSON mode working - bidirectional sync between UI and JSON
- Strategy saves to database correctly
- Edit button now functional - loads existing strategies into dialog for editing
- Update method correctly preserves _id and _rev when saving changes

**Implementation Notes:**
- Created HierarchyConfigForm.vue with dual input modes (Visual/JSON)
- Visual mode features:
  - Add/remove prerequisite rules (gated tags)
  - For each rule: select tag, add multiple prerequisites
  - Each prerequisite: tag selector, min count, optional min ELO
  - Delegate strategy dropdown
- JSON mode: paste/edit full config with validation
- Loads course tags via getDataLayer().getCourseDB().getCourseTagStubs()
- Basic circular dependency detection
- Modified NavigationStrategyEditor to:
  - Import and register HierarchyConfigForm
  - Add getDefaultConfig() method for all strategy types
  - Add getStrategyTypeFromClass() to map Navigators enum back to UI types
  - Add parseSerializedData() to deserialize config for editing
  - Add editingStrategy state to track edit mode
  - Add watcher to reset config when strategy type changes
  - Add hierarchy-specific validation in saveStrategy()
  - Implement editStrategy() to populate dialog with existing data
  - Updated saveStrategy() to handle both create and update cases
  - Dialog title and button text change based on edit mode

---

## Phase 3: Interference Strategy Form - COMPLETED

### P3.1: Create InterferenceConfigForm Component - COMPLETED
- [x] Create `InterferenceConfigForm.vue`
  - Props: `modelValue` (InterferenceConfig), `courseId`
  - Emits: `update:modelValue`
  - Fetch available tags from course
- [x] Implement interference group builder UI
  - Add group button
  - For each group:
    - Tag multi-selector (tags that interfere with each other)
    - Decay slider (0-1, default 0.8)
  - Remove group button
- [x] Add maturity threshold inputs
  - minCount (default 10)
  - minElo (optional)
  - minElapsedDays (default 3)
- [x] Add bulk text input support
  - JSON paste area with preview
  - Dual mode tabs: Visual Editor / JSON Editor
- [x] Add delegate strategy selector
- [x] Add defaultDecay slider
- [x] Validate config
  - Interference sets must be array
  - Each group needs at least 2 tags
  - Decay values must be 0-1
  - Show validation errors

### P3.2: Test Interference Strategy Creation - COMPLETED
- [x] Create an interference strategy via UI
- [x] Verify database persistence
- [x] Verify config round-trips correctly

**Implementation Notes:**
- Created InterferenceConfigForm.vue with dual input modes
- Visual mode features:
  - Maturity threshold config (minCount, minElo, minElapsedDays)
  - Default decay slider
  - Add/remove interference groups
  - Multi-tag selector for each group
  - Per-group decay slider
- JSON mode for bulk editing
- Validation ensures groups have 2+ tags, decay in valid range
- Integrated into NavigationStrategyEditor with validation

---

## Phase 4: RelativePriority Strategy Form - COMPLETED

### P4.1: Create RelativePriorityConfigForm Component - COMPLETED
- [x] Create `RelativePriorityConfigForm.vue`
  - Props: `modelValue` (RelativePriorityConfig), `courseId`
  - Emits: `update:modelValue`
  - Fetch available tags from course
- [x] Implement tag priority list UI
  - List all course tags
  - Priority slider (0-1) for each tag
  - Shows default priority if not explicitly set
- [x] Add bulk text input support
  - JSON paste area with preview
  - Dual mode tabs: Visual Editor / JSON Editor
- [x] Add configuration inputs
  - defaultPriority slider (0-1)
  - combineMode selector (max/average/min)
  - priorityInfluence slider (0-1)
- [x] Add delegate strategy selector
- [x] Validate config
  - Tag priorities must be object
  - All priorities must be 0-1
  - Show validation errors

### P4.2: Test RelativePriority Strategy Creation - COMPLETED
- [x] Create a relativePriority strategy via UI
- [x] Verify database persistence
- [x] Verify config round-trips correctly

**Implementation Notes:**
- Created RelativePriorityConfigForm.vue with dual input modes
- Visual mode features:
  - Configuration options (defaultPriority, combineMode, priorityInfluence)
  - List all course tags with individual priority sliders
  - Each tag shows current priority (explicit or default)
  - Scrollable tag list with max height
- JSON mode for bulk editing
- Validation ensures priorities are numbers between 0-1
- Integrated into NavigationStrategyEditor with validation

---

## Phase 5: Polish & Testing - COMPLETED

### P5.1: Validation Enhancements - DEFERRED
- [ ] Review navigator parseConfig methods for strictness
- [ ] Add informative error messages where parsers are too permissive
- [ ] Consider extracting validation helpers if duplication emerges

### P5.2: UX Improvements - PARTIALLY COMPLETE
- [x] Dual mode tabs (Visual/JSON) for all forms
- [x] Sliders with numeric input fields
- [x] Hints and persistent hints on fields
- [ ] Add example configs (expandable help text) - DEFERRED
- [x] JSON preview available in JSON mode
- [x] Validation summary (inline error alerts)

### P5.3: Integration Testing - COMPLETED
- [x] All four strategy types have forms
- [x] Switching between strategy types works (resets config)
- [x] Edit functionality works for all types
- [x] Backwards compatibility maintained (hardcoded still works)
- [x] User testing with real course data - PASSED

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

- [x] All strategy types can be created via UI
- [x] Validation catches invalid configs
- [x] Bulk JSON input works for all forms
- [x] Tag selectors populate from course
- [x] Delegate strategy selector works
- [x] Configs save to database correctly
- [x] Backwards compatibility with existing HARDCODED strategies
- [x] UI is responsive and doesn't break on small screens
- [x] Error messages are clear and actionable
- [x] Edit functionality works for all strategy types
- [x] Config round-trips correctly (save → edit → displays original config)

---

## Summary

All four navigation strategy configuration forms have been implemented:

1. **HardcodedOrderConfigForm** - Simple card ID list
2. **HierarchyConfigForm** - Prerequisite gating with mastery thresholds
3. **InterferenceConfigForm** - Interference groups with decay coefficients
4. **RelativePriorityConfigForm** - Per-tag priority weights with combine modes

**Key Features:**
- Dual input modes (Visual Editor / JSON Editor) for all forms
- Tag loading from course database
- Real-time validation with error messages
- Edit functionality for modifying existing strategies
- Consistent UI patterns across all forms
- Delegate strategy selector in all advanced forms

**Ready for user testing in studio-ui via `/course-editor` route.**

---

## UI Improvements - COMPLETED

### Density & Layout Improvements
- [x] Removed modal dialog - form now always visible
- [x] Two-column layout: Strategy list (left) | Strategy form (right)
- [x] Compact density throughout (compact buttons, smaller text, tighter spacing)
- [x] Responsive layout (stacks on small screens)
- [x] Simplified list items (removed verbose config display)
- [x] Form always visible and ready to edit
- [x] Edit/Create flows seamlessly - no modal popup

**Changes:**
- `NavigationStrategyEditor`: Removed v-dialog, added grid layout with two columns
- `NavigationStrategyList`: Changed to compact density, two-line items, x-small buttons
- All forms remain in Visual/JSON dual-mode tabs
- Form resets after save automatically
