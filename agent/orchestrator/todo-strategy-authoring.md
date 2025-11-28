# TODO: NavigationStrategy Authoring Tools

## Status: NOT STARTED

## Goal

Provide tools for course authors to create and configure NavigationStrategy documents
without direct database manipulation. This includes UI components, CLI commands, and
potentially MCP tools.

## Current State

### What Exists

| Component | Location | Status |
|-----------|----------|--------|
| `NavigationStrategyEditor.vue` | `packages/edit-ui/src/components/NavigationStrategy/` | Only creates HARDCODED strategies |
| `NavigationStrategyList.vue` | `packages/edit-ui/src/components/NavigationStrategy/` | Lists strategies, sets default |
| `CourseDB.addNavigationStrategy()` | `packages/db/src/impl/couch/courseDB.ts` | DB write method exists |
| `CourseDB.getAllNavigationStrategies()` | `packages/db/src/impl/couch/courseDB.ts` | DB read method exists |
| `ContentNavigationStrategyData` | `packages/db/src/core/types/contentNavigationStrategy.ts` | Data schema exists |

### What's Missing

- UI forms for Hierarchy, Interference, RelativePriority configs
- CLI commands for strategy creation
- MCP tools for agent-based authoring
- Validation of strategy configurations
- Preview/testing of strategy behavior

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

## Recommended Approach

**Phase 1: CLI (Quick Win)**
- Fastest to implement
- Enables immediate testing of strategies
- Can be used by agents via terminal tool

**Phase 2: MCP Tools**
- Natural extension of existing MCP infrastructure
- Enables agent-driven course authoring
- Config generation can be guided by prompts

**Phase 3: UI (Full Solution)**
- User-friendly for course authors
- Visual feedback and validation
- Can reference CLI/MCP implementations for logic

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

## Files to Create/Modify

### Option A: UI

| File | Action | Description |
|------|--------|-------------|
| `packages/edit-ui/src/components/NavigationStrategy/HierarchyConfigForm.vue` | CREATE | Hierarchy config form |
| `packages/edit-ui/src/components/NavigationStrategy/InterferenceConfigForm.vue` | CREATE | Interference config form |
| `packages/edit-ui/src/components/NavigationStrategy/RelativePriorityConfigForm.vue` | CREATE | Priority config form |
| `packages/edit-ui/src/components/NavigationStrategy/NavigationStrategyEditor.vue` | MODIFY | Add type selector, conditional forms |

### Option B: CLI

| File | Action | Description |
|------|--------|-------------|
| `packages/cli/src/commands/strategy.ts` | CREATE | Strategy management commands |
| `packages/cli/src/utils/strategy-validation.ts` | CREATE | Config validation utilities |
| `packages/cli/src/index.ts` | MODIFY | Register strategy commands |

### Option C: MCP

| File | Action | Description |
|------|--------|-------------|
| `packages/mcp/src/tools/navigationStrategy.ts` | CREATE | Strategy creation tools |
| `packages/mcp/src/index.ts` | MODIFY | Register new tools |

---

## Related Files

- `packages/db/src/core/types/contentNavigationStrategy.ts` — Strategy data schema
- `packages/db/src/impl/couch/courseDB.ts` — DB methods for strategies
- `packages/db/src/core/navigators/hierarchyDefinition.ts` — Config interface reference
- `packages/db/src/core/navigators/interferenceMitigator.ts` — Config interface reference
- `packages/db/src/core/navigators/relativePriority.ts` — Config interface reference
- `packages/edit-ui/src/components/NavigationStrategy/` — Existing UI components