# NavigationStrategy Authoring Tools

## Status: UI COMPLETE ✅ (CLI/MCP Optional)

## Goal

Provide tools for course authors to create and configure NavigationStrategy documents
without direct database manipulation. This includes UI components, CLI commands, and
potentially MCP tools.

**UI implementation completed.** CLI and MCP remain as optional future enhancements for
scriptable/agent-based workflows.

## Current State (Updated)

### What Exists ✅

| Component | Location | Status |
|-----------|----------|--------|
| `HardcodedOrderConfigForm.vue` | `packages/edit-ui/src/components/NavigationStrategy/` | ✅ Complete |
| `HierarchyConfigForm.vue` | `packages/edit-ui/src/components/NavigationStrategy/` | ✅ Complete |
| `InterferenceConfigForm.vue` | `packages/edit-ui/src/components/NavigationStrategy/` | ✅ Complete |
| `RelativePriorityConfigForm.vue` | `packages/edit-ui/src/components/NavigationStrategy/` | ✅ Complete |
| `NavigationStrategyEditor.vue` | `packages/edit-ui/src/components/NavigationStrategy/` | ✅ All strategy types supported |
| `NavigationStrategyList.vue` | `packages/edit-ui/src/components/NavigationStrategy/` | ✅ Compact layout, edit/delete |
| `CourseDB.addNavigationStrategy()` | `packages/db/src/impl/couch/courseDB.ts` | ✅ DB write method |
| `CourseDB.updateNavigationStrategy()` | `packages/db/src/impl/couch/courseDB.ts` | ✅ DB update method |
| `CourseDB.getAllNavigationStrategies()` | `packages/db/src/impl/couch/courseDB.ts` | ✅ DB read method |

### What's Complete

- ✅ UI forms for all four strategy types (Hardcoded, Hierarchy, Interference, RelativePriority)
- ✅ Dual input modes (Visual Editor / JSON Editor) for each form
- ✅ Tag loading from course database
- ✅ Real-time validation with error messages
- ✅ Edit functionality for existing strategies
- ✅ Compact, non-modal two-column layout
- ✅ Responsive design (desktop and mobile)
- ✅ Full CRUD operations (Create, Read, Update, Delete)

### What's Optional (Future Enhancements)

- ⏸️ CLI commands for strategy creation (scriptable workflows)
- ⏸️ MCP tools for agent-based authoring (LLM-guided config generation)
- ⏸️ Strategy behavior preview/simulation

## Strategy Types and Their Configs

### 1. HierarchyDefinition

```typescript
interface HierarchyConfig {
  prerequisites: {
    [tagId: string]: TagPrerequisite[];
  };
  delegateStrategy?: string;  // default: "elo"
}

interface TagPrerequisite {
  tag: string;
  masteryThreshold?: {
    minElo?: number;
    minCount?: number;
  };
}
```

**Example:**
```json
{
  "prerequisites": {
    "cvc-words": [
      { "tag": "letter-sounds", "masteryThreshold": { "minCount": 10, "minElo": 1050 } }
    ],
    "blends": [
      { "tag": "cvc-words", "masteryThreshold": { "minCount": 20 } }
    ]
  },
  "delegateStrategy": "elo"
}
```

**UI Requirements:**
- Tag selector (from course's available tags)
- Prerequisite builder (tag → requires tags with thresholds)
- Threshold inputs (minCount, minElo)
- Delegate strategy selector

---

### 2. InterferenceMitigator

```typescript
interface InterferenceConfig {
  interferenceSets: InterferenceGroup[];
  maturityThreshold?: {
    minCount?: number;
    minElo?: number;
    minElapsedDays?: number;
  };
  defaultDecay?: number;
  delegateStrategy?: string;
}

interface InterferenceGroup {
  tags: string[];
  decay?: number;
}
```

**Example:**
```json
{
  "interferenceSets": [
    { "tags": ["letter-b", "letter-d", "letter-p"], "decay": 0.9 },
    { "tags": ["letter-m", "letter-n"], "decay": 0.7 }
  ],
  "maturityThreshold": { "minCount": 15, "minElapsedDays": 3 },
  "defaultDecay": 0.8
}
```

**UI Requirements:**
- Interference group builder (add/remove groups)
- Tag multi-selector for each group
- Decay slider (0-1) per group
- Maturity threshold inputs
- Delegate strategy selector

---

### 3. RelativePriority

```typescript
interface RelativePriorityConfig {
  tagPriorities: { [tagId: string]: number };
  defaultPriority?: number;
  combineMode?: 'max' | 'average' | 'min';
  priorityInfluence?: number;
  delegateStrategy?: string;
}
```

**Example:**
```json
{
  "tagPriorities": {
    "letter-s": 0.95,
    "letter-t": 0.90,
    "letter-a": 0.88,
    "letter-x": 0.10,
    "letter-z": 0.05
  },
  "defaultPriority": 0.5,
  "combineMode": "max",
  "priorityInfluence": 0.5
}
```

**UI Requirements:**
- Tag list with priority sliders (0-1)
- Default priority input
- Combine mode selector (max/average/min)
- Priority influence slider
- Delegate strategy selector

---

## Implementation Options

### Option A: Extend NavigationStrategyEditor.vue

**Pros:**
- Single location for all strategy editing
- Consistent with existing UI patterns
- User-facing, accessible to course authors

**Cons:**
- More complex Vue component
- Requires form validation logic

**Implementation:**
1. Add strategy type selector dropdown
2. Conditional rendering of config forms based on type
3. Form validation before save
4. Serialize config to `serializedData` JSON

---

### Option B: CLI Commands

**Pros:**
- Scriptable, automatable
- Good for bulk operations
- Can be used by agents

**Cons:**
- Not user-friendly for non-technical authors
- Requires terminal access

**Implementation:**
```bash
# Create a hierarchy strategy
yarn cli strategy:create <courseId> \
  --type hierarchy \
  --name "Phonics Progression" \
  --config ./hierarchy-config.json

# Create an interference strategy
yarn cli strategy:create <courseId> \
  --type interference \
  --config ./interference-config.json

# List strategies
yarn cli strategy:list <courseId>

# Set default strategy
yarn cli strategy:set-default <courseId> <strategyId>

# Delete strategy
yarn cli strategy:delete <courseId> <strategyId>
```

**Files to modify:**
- `packages/cli/src/commands/` — Add strategy commands
- `packages/cli/src/index.ts` — Register new commands

---

### Option C: MCP Tools

**Pros:**
- Agent-accessible for automated course building
- Consistent with existing MCP pattern
- Can leverage LLM for config generation

**Cons:**
- Requires MCP client
- Not directly user-facing

**Implementation:**
Add to `packages/mcp/src/tools/`:

```typescript
// create_navigation_strategy tool
{
  name: 'create_navigation_strategy',
  description: 'Create a navigation strategy for the course',
  inputSchema: {
    type: 'object',
    properties: {
      strategyType: { enum: ['hierarchy', 'interference', 'relativePriority'] },
      name: { type: 'string' },
      description: { type: 'string' },
      config: { type: 'object' }
    }
  }
}
```

---

## Implementation Completed: UI-First Approach ✅

**Phase 1: UI Forms (COMPLETED)**
- ✅ All four strategy configuration forms implemented
- ✅ Visual editor with guided inputs
- ✅ JSON editor for power users
- ✅ Tag selectors, sliders, multi-selects
- ✅ Validation and error messages
- ✅ Edit/Create/Delete functionality
- ✅ Compact two-column layout (list + form)

**Phase 2 (Optional): CLI Commands**
- Scriptable strategy creation from JSON files
- Bulk operations and automation
- Terminal-based workflows
- **Status:** Not started, optional enhancement

**Phase 3 (Optional): MCP Tools**
- Agent-accessible strategy authoring
- LLM-guided config generation
- Extends existing MCP infrastructure
- **Status:** Not started, optional enhancement

---

## Validation Requirements

All authoring tools should validate:

1. **Tag existence**: All referenced tags exist in the course
2. **Circular dependencies** (Hierarchy): No circular prerequisite chains
3. **Config completeness**: Required fields present
4. **Value ranges**: Scores/thresholds in valid ranges (e.g., 0-1)
5. **Delegate validity**: Delegate strategy type exists

```typescript
interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}
```

---

## Files Created/Modified

### UI Implementation (COMPLETED ✅)

| File | Action | Description | Status |
|------|--------|-------------|--------|
| `packages/edit-ui/src/components/NavigationStrategy/HardcodedOrderConfigForm.vue` | CREATED | Card ID list form | ✅ |
| `packages/edit-ui/src/components/NavigationStrategy/HierarchyConfigForm.vue` | CREATED | Prerequisite gating config | ✅ |
| `packages/edit-ui/src/components/NavigationStrategy/InterferenceConfigForm.vue` | CREATED | Interference groups config | ✅ |
| `packages/edit-ui/src/components/NavigationStrategy/RelativePriorityConfigForm.vue` | CREATED | Tag priorities config | ✅ |
| `packages/edit-ui/src/components/NavigationStrategy/NavigationStrategyEditor.vue` | MODIFIED | Two-column layout, all strategy types | ✅ |
| `packages/edit-ui/src/components/NavigationStrategy/NavigationStrategyList.vue` | MODIFIED | Compact density, simplified display | ✅ |

### CLI Implementation (OPTIONAL, NOT STARTED)

| File | Action | Description | Status |
|------|--------|-------------|--------|
| `packages/cli/src/commands/strategy.ts` | CREATE | Strategy management commands | ⏸️ |
| `packages/cli/src/utils/strategy-validation.ts` | CREATE | Config validation utilities | ⏸️ |
| `packages/cli/src/index.ts` | MODIFY | Register strategy commands | ⏸️ |

### MCP Implementation (OPTIONAL, NOT STARTED)

| File | Action | Description | Status |
|------|--------|-------------|--------|
| `packages/mcp/src/tools/create-navigation-strategy.ts` | CREATE | Create strategy tool | ⏸️ |
| `packages/mcp/src/tools/update-navigation-strategy.ts` | CREATE | Update strategy tool | ⏸️ |
| `packages/mcp/src/tools/list-navigation-strategies.ts` | CREATE | List strategies tool | ⏸️ |
| `packages/mcp/src/tools/delete-navigation-strategy.ts` | CREATE | Delete strategy tool | ⏸️ |
| `packages/mcp/src/types/tools.ts` | MODIFY | Add strategy schemas | ⏸️ |
| `packages/mcp/src/tools/index.ts` | MODIFY | Export new tools | ⏸️ |

---

## Key Features Delivered

### Dual Input Modes
All forms support two modes for flexibility:
- **Visual Editor**: Guided UI with selectors, sliders, and inputs
- **JSON Editor**: Direct JSON editing with real-time validation

### Strategy-Specific Capabilities

**HierarchyConfigForm:**
- Add/remove prerequisite rules
- Tag selectors for gated tags and their prerequisites
- Mastery thresholds (minCount, minElo)
- Delegate strategy selector

**InterferenceConfigForm:**
- Add/remove interference groups
- Multi-tag selector for each group
- Per-group decay sliders (0-1)
- Maturity threshold configuration (minCount, minElo, minElapsedDays)
- Default decay setting

**RelativePriorityConfigForm:**
- Individual priority sliders for all course tags
- Default priority configuration
- Combine mode selector (max/average/min)
- Priority influence slider

### User Experience
- **Compact Layout**: Two-column design (strategy list + form)
- **Always Visible**: No modal dialogs, form always accessible
- **Responsive**: Works on desktop and mobile
- **Real-time Validation**: Inline error messages
- **Tag Loading**: Automatically fetches course tags
- **Edit Support**: Click any strategy to edit

---

## Access

The NavigationStrategy editor is accessible in:
- **studio-ui**: `/course-editor` route → "Navigation" tab
- **platform-ui**: `/edit/:courseId` route → "Navigation" tab

---

## Related Files

- `packages/db/src/core/types/contentNavigationStrategy.ts` — Strategy data schema
- `packages/db/src/impl/couch/courseDB.ts` — DB methods for strategies
- `packages/db/src/core/navigators/hierarchyDefinition.ts` — Config interface reference
- `packages/db/src/core/navigators/interferenceMitigator.ts` — Config interface reference
- `packages/db/src/core/navigators/relativePriority.ts` — Config interface reference
- `packages/edit-ui/src/components/NavigationStrategy/` — UI components (all forms)