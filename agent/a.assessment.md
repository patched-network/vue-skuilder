# Navigation Strategy UI Fitness Assessment

## Executive Summary

**Finding: The navigation strategy UI has drifted from the current data model.** Three filter strategy editors (Hierarchy, Interference, RelativePriority) contain a `delegateStrategy` field that no longer matches the current architecture.

The current system uses a Pipeline pattern where:
- **Generators** produce initial candidates (ELO, SRS, Hardcoded)
- **Filters** transform scores (Hierarchy, Interference, RelativePriority, UserTagPreference, EloDistance)
- Filters are composable multipliers—they don't delegate to generators

The UI incorrectly treats filters as if they could each independently select a generator strategy.

---

## Current Architecture vs UI Implementation

### The Data Model (Source of Truth)

From `navigators-architecture.md`:

```
Pipeline = Generator + [Filters...]

- Generator: Produces WeightedCard[] with initial scores
- Filter: Transforms WeightedCard[] → WeightedCard[] (pure function, multiplier-based)
```

**Key insight from documentation:**
> All filters are multipliers. Filter order doesn't affect final scores (multiplication is commutative). Filters are applied alphabetically for determinism.

### The UI Implementation (Current State)

Three filter configuration forms ALL include a `delegateStrategy` field:

#### **HierarchyConfigForm.vue** (lines 12-21)
```vue
<v-select
  :model-value="config.delegateStrategy || 'elo'"
  @update:model-value="updateDelegateStrategy"
  label="Delegate Strategy"
  :items="delegateStrategies"
  hint="Strategy used to generate candidate cards"
  persistent-hint
  class="mb-4"
></v-select>
```

**UI Interface** (line 162-167):
```typescript
export interface HierarchyConfig {
  prerequisites: { [tagId: string]: TagPrerequisite[] };
  delegateStrategy?: string;  // ← NOT IN CURRENT DATA MODEL
}
```

#### **InterferenceConfigForm.vue** (lines 12-21)
Same pattern—includes `delegateStrategy` field for ELO/SRS selection.

**UI Interface** (line 204-213):
```typescript
export interface InterferenceConfig {
  interferenceSets: InterferenceGroup[];
  maturityThreshold?: { minCount?: number; minElo?: number; minElapsedDays?: number };
  defaultDecay?: number;
  delegateStrategy?: string;  // ← NOT IN CURRENT DATA MODEL
}
```

#### **RelativePriorityConfigForm.vue** (lines 12-21)
Same pattern—includes `delegateStrategy` field for ELO/SRS selection.

**UI Interface** (line 174-180):
```typescript
export interface RelativePriorityConfig {
  tagPriorities: { [tagId: string]: number };
  defaultPriority?: number;
  combineMode?: 'max' | 'average' | 'min';
  priorityInfluence?: number;
  delegateStrategy?: string;  // ← NOT IN CURRENT DATA MODEL
}
```

### Backend Reality

**ContentNavigationStrategyData** (`core/types/contentNavigationStrategy.ts`, lines 32-60):
```typescript
export interface ContentNavigationStrategyData extends SkuilderCourseData {
  _id: `${typeof DocTypePrefixes[DocType.NAVIGATION_STRATEGY]}-${string}`;
  docType: DocType.NAVIGATION_STRATEGY;
  name: string;
  description: string;
  implementingClass: string;
  serializedData: string;        // ← Configuration stored here
  learnable?: LearnableWeight;   // ← NEW: Evolutionary weighting (NOT IN UI)
  staticWeight?: boolean;        // ← NEW: Manual override flag (NOT IN UI)
}
```

**Verification**: Grep search for `delegateStrategy` in `packages/db/src/` yields **zero results**. The field is not referenced anywhere in the backend implementation.

---

## UI Components and Their Fitness

### ✅ NavigationStrategyEditor.vue
**Status: GOOD**
- Correctly routes to type-specific forms (hierarchy, interference, relativePriority)
- Handles name/description fields
- Saves to backend via `ContentNavigationStrategyData` interface
- **Note**: Could add fields for `learnable` and `staticWeight` at this level

### ✅ NavigationStrategyList.vue
**Status: GOOD**
- Displays strategies with edit/delete operations
- Allows setting default strategy
- No issues with current implementation

### ❌ HierarchyConfigForm.vue
**Status: OUT OF SYNC**

**Issues:**
1. **delegateStrategy field (lines 12-21, 164-166)**
   - Not used by backend
   - Misleading hint: "Strategy used to generate candidate cards"
   - Filters don't generate—generators do
   - Filter is part of Pipeline, not independent

2. **Missing evolutionary learning UI**
   - No `learnable` weight configuration
   - No `staticWeight` toggle
   - User cannot control whether hierarchy adapts over time

3. **JSON template includes delegateStrategy**
   - Line 127 placeholder shows delegateStrategy in example
   - Misleads users about configuration format

### ❌ InterferenceConfigForm.vue
**Status: OUT OF SYNC**

**Issues:**
1. **delegateStrategy field (lines 12-21, 212)**
   - Same issues as Hierarchy
   - Technically optional but still present and confusing

2. **Missing evolutionary learning UI**
   - No `learnable` weight configuration
   - No `staticWeight` toggle

3. **JSON template includes delegateStrategy**
   - Line 172 placeholder shows delegateStrategy in example

### ❌ RelativePriorityConfigForm.vue
**Status: OUT OF SYNC**

**Issues:**
1. **delegateStrategy field (lines 12-21, 179)**
   - Same issues as above two forms
   - Extra confusing here since priority is clearly a filter operation

2. **Missing evolutionary learning UI**
   - No `learnable` weight configuration
   - No `staticWeight` toggle

3. **JSON template includes delegateStrategy**
   - Line 147 placeholder shows delegateStrategy in example

---

## Integration Point: CourseEditor.vue

From Explore agent findings, `NavigationStrategyEditor` is integrated into the course editor.

**Question for assessment:** Where IS the generator selection happening? Is it:
- At the course level (default generator)?
- In PipelineAssembler?
- Currently hard-coded in courseDB.createNavigator()?

Looking at `navigators-architecture.md` line 135-141:
```
If no strategies are configured, courseDB.createNavigator() returns a default pipeline:
Pipeline(
  CompositeGenerator([ELONavigator, SRSNavigator]),
  [eloDistanceFilter]
)
```

This suggests **generators are NOT configured per-course via UI**—they're hard-coded defaults.

---

## Summary Table

| Component | delegateStrategy Field | learnable UI | staticWeight UI | Comments |
|-----------|:-----:|:-----:|:-----:|----------|
| HierarchyConfigForm | ❌ Present | ❌ Missing | ❌ Missing | Confusing hint about card generation |
| InterferenceConfigForm | ❌ Present | ❌ Missing | ❌ Missing | Less obviously wrong but still inconsistent |
| RelativePriorityConfigForm | ❌ Present | ❌ Missing | ❌ Missing | Most obviously wrong—priority is clearly filtering |
| NavigationStrategyEditor | ✅ N/A | ❓ Unclear | ❓ Unclear | Should these live at editor or form level? |

---

## Root Cause

This appears to be **architectural drift** from an earlier strategy system where:
- Each filter might independently select which generator to use
- No learnable/evolutionary weights existed

The current system has evolved to:
- Centralized generator selection (at Pipeline/course level)
- Learnable weights for all strategies (filters AND generators)
- Static weight override capability for manual tuning

The UI code was not updated to match.

---

## Recommendation

**PRIORITY: Remove obsolete `delegateStrategy` field from all three filter form components, and add learnable weight configuration UI.**

**Specific actions:**
1. ✅ **Remove** `delegateStrategy` property from HierarchyConfig, InterferenceConfig, RelativePriorityConfig interfaces
2. ✅ **Remove** delegate strategy selector UI (`<v-select>` blocks lines 12-21 in each form)
3. ✅ **Remove** `updateDelegateStrategy` methods and related handlers
4. ✅ **Update** JSON editor placeholders to remove delegateStrategy examples
5. ✅ **Add** learnable weight UI to either:
   - Option A: Each individual form (fine-grained control)
   - Option B: NavigationStrategyEditor (centralized control)
   - *Recommendation: Option B* for consistency and to avoid duplication
6. ✅ **Add** `staticWeight` toggle to NavigationStrategyEditor

This will align the UI with the documented Pipeline architecture and enable users to configure evolutionary learning per strategy.
