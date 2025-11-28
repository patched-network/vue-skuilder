# Assessment: NavigationStrategy Authoring Tools

## Context

NavigationStrategy configurations are currently author-editable only through direct database manipulation. The existing UI (`NavigationStrategyEditor.vue`) only supports creating HARDCODED strategies (fixed card sequences). We need authoring tools for the three sophisticated filter strategies:

1. **HierarchyDefinition** - Prerequisite gating based on tag mastery
2. **InterferenceMitigator** - Avoids introducing confusable content during immature learning
3. **RelativePriority** - Boosts high-utility content (e.g., common letters before rare ones)

## Current State Analysis

### What Exists

**Database Layer** (`packages/db/src/impl/couch/courseDB.ts`)
- ✅ `addNavigationStrategy(strategyData)` - Creates strategies
- ✅ `getAllNavigationStrategies()` - Retrieves all strategies
- ✅ `updateNavigationStrategy(id, strategyData)` - Updates existing
- ✅ Well-defined config interfaces in navigator implementations

**UI Layer**
- ✅ `studio-ui/CourseEditorView.vue` → imports `CourseEditor` from `edit-ui`
- ✅ `edit-ui/CourseEditor.vue` → has "Navigation" tab wired up
- ✅ `edit-ui/NavigationStrategyList.vue` - Lists strategies, sets default
- ⚠️ `edit-ui/NavigationStrategyEditor.vue` - **Only creates HARDCODED strategies**
  - Has dialog infrastructure
  - Has loading/saving patterns
  - Missing: config forms for Hierarchy/Interference/RelativePriority
- **CRITICAL:** UI is already **discoverable and accessible** via `yarn cli studio` → `/course-editor` route

**CLI** (`packages/cli/src/commands/`)
- ✅ `pack.ts`, `unpack.ts`, `studio.ts`, `init.ts`
- ❌ No strategy management commands

**MCP** (`packages/mcp/src/tools/`)
- ✅ `create-card.ts`, `update-card.ts`, `tag-card.ts`, `delete-card.ts`
- ❌ No strategy authoring tools

### Navigator Config Complexity Assessment

| Strategy | Config Fields | UI Complexity | Validation Needs |
|----------|---------------|---------------|------------------|
| **Hierarchy** | Prerequisites map, delegate | **Medium** | Circular deps, tag existence |
| **Interference** | Groups, decay coefficients, maturity thresholds | **Medium-High** | Tag existence, decay ranges |
| **RelativePriority** | Tag priorities, combine mode, influence | **Low-Medium** | Tag existence, priority ranges |

All strategies need:
- Tag selector (from course's available tags)
- Delegate strategy picker
- JSON validation before save

## Implementation Options

### Option A: UI-First (Extend NavigationStrategyEditor.vue)

**Approach:**
- Add strategy type dropdown to editor dialog
- Create sub-components for each strategy type's config form:
  - `HierarchyConfigForm.vue`
  - `InterferenceConfigForm.vue`
  - `RelativePriorityConfigForm.vue`
- Conditionally render appropriate form based on type
- Serialize config to `serializedData` field

**Files to Create:**
```
packages/edit-ui/src/components/NavigationStrategy/

├── HierarchyConfigForm.vue          (NEW)
├── InterferenceConfigForm.vue       (NEW)
├── RelativePriorityConfigForm.vue   (NEW)
└── NavigationStrategyEditor.vue     (MODIFY - add type selector)
```

**Pros:**
- ✅ User-friendly for non-technical course authors
- ✅ Immediate visual feedback and validation
- ✅ Consistent with existing edit-ui patterns
- ✅ Can leverage Vuetify components (sliders, multi-select, etc.)

**Cons:**
- ❌ Most complex Vue work (3 new forms + editor refactor)
- ❌ Not automatable or scriptable
- ❌ Requires manual testing with UI

**Effort Estimate:** Medium-High (3-4 new components, validation logic, form state management)

---

### Option B: CLI-First (Add strategy commands)

**Approach:**
- Create `commands/strategy.ts` with subcommands:
  - `strategy:create <courseId> --type <type> --config <file.json>`
  - `strategy:list <courseId>`
  - `strategy:set-default <courseId> <strategyId>`
  - `strategy:delete <courseId> <strategyId>`
- Read config from JSON file
- Validate against schemas
- Write to CourseDB via existing methods

**Files to Create:**
```
packages/cli/src/
├── commands/strategy.ts                (NEW - main command)
├── utils/strategy-validation.ts        (NEW - config validation)
└── index.ts                            (MODIFY - register commands)
```

**Pros:**
- ✅ Fastest to implement
- ✅ Scriptable and automatable
- ✅ Can be used by agents via shell tool
- ✅ Good for bulk operations / testing
- ✅ Natural fit for config-as-code workflows

**Cons:**
- ❌ Not user-friendly for non-technical authors
- ❌ Requires JSON hand-authoring
- ❌ Less discoverable than UI

**Effort Estimate:** Low-Medium (1 command file + validation utilities)

**Example Usage:**
```bash
# Create hierarchy config
cat > hierarchy.json <<EOF
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
EOF

yarn cli strategy:create my-course \
  --type hierarchy \
  --name "Phonics Progression" \
  --config hierarchy.json
```

---

### Option C: MCP-First (Add strategy tools to MCP server)

**Approach:**
- Add to `packages/mcp/src/tools/`:
  - `create-navigation-strategy.ts`
  - `update-navigation-strategy.ts`
  - `list-navigation-strategies.ts`
  - `delete-navigation-strategy.ts`
- Define Zod schemas for each strategy config type
- Expose via MCP tool interface

**Files to Create:**
```
packages/mcp/src/
├── tools/
│   ├── create-navigation-strategy.ts  (NEW)
│   ├── update-navigation-strategy.ts  (NEW)
│   ├── list-navigation-strategies.ts  (NEW)
│   ├── delete-navigation-strategy.ts  (NEW)
│   └── index.ts                       (MODIFY - export new tools)
└── types/tools.ts                     (MODIFY - add schemas)
```

**Pros:**
- ✅ Natural extension of existing MCP infrastructure
- ✅ Enables agent-driven course authoring
- ✅ LLM can help generate configs from natural language
- ✅ Consistent with existing card/tag tools
- ✅ Can be exposed via CLI studio command

**Cons:**
- ❌ Requires MCP client (Claude Code or similar)
- ❌ Not directly user-facing
- ❌ Adds complexity to MCP server

**Effort Estimate:** Medium (4 new tool handlers + schemas + registration)

**Example Usage (via Claude Code):**
```typescript
// Agent receives request: "Create a hierarchy strategy where 'blends' requires 'cvc-words'"
// Agent uses MCP tool:
{
  name: "create_navigation_strategy",
  input: {
    strategyType: "hierarchy",
    name: "Phonics Progression",
    description: "Introduces blends only after CVC mastery",
    config: {
      prerequisites: {
        "blends": [
          { tag: "cvc-words", masteryThreshold: { minCount: 15 } }
        ]
      },
      delegateStrategy: "elo"
    }
  }
}
```

---

### Option D: Hybrid Approach (CLI + MCP)

**Approach:**
- Implement CLI commands first (Option B)
- Wrap CLI commands with MCP tools (thin wrapper)
- Optionally add UI later (Option A) using validation from CLI

**Rationale:**
- CLI provides immediate, testable foundation
- MCP leverages CLI validation logic
- UI can be added incrementally as time allows

**Sequencing:**
1. **Phase 1:** CLI commands with validation (1-2 days)
2. **Phase 2:** MCP tools wrapping CLI logic (1 day)
3. **Phase 3 (optional):** UI forms for non-technical users (3-4 days)

**Pros:**
- ✅ Fastest path to working implementation
- ✅ Incremental value delivery
- ✅ Reuses validation logic across CLI/MCP/UI
- ✅ Both human and agent accessible

**Cons:**
- ❌ Multiple touch points to maintain
- ❌ Potential for duplication if not careful

---

## Validation Requirements

All authoring tools must validate:

1. **Tag Existence**: All referenced tags exist in course
2. **Circular Dependencies** (Hierarchy only): No circular prerequisite chains
3. **Config Completeness**: Required fields present
4. **Value Ranges**:
   - Decay coefficients: 0-1
   - Priorities: 0-1
   - ELO thresholds: reasonable range
   - Counts: positive integers
5. **Delegate Validity**: Referenced delegate strategy exists

**Validation Function Signature:**
```typescript
interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
}

function validateStrategyConfig(
  strategyType: 'hierarchy' | 'interference' | 'relativePriority',
  config: unknown,
  availableTags: string[]
): ValidationResult;
```

## Skill Exposure Considerations

For CLI → Claude Code skill exposure, we'd need:

1. **Skill Definition** (`.claude/skills/strategy-authoring.md`):
   - Documents CLI commands
   - Provides config schema reference
   - Example workflows

2. **MCP Alternative**: If we implement MCP tools, skill definition becomes simpler:
   - Just point to MCP server
   - LLM discovers tools via MCP protocol
   - No manual documentation needed

**Recommendation:** MCP approach is more maintainable for skill exposure (self-documenting).

---

# Recommendation

## Proposed Approach: **UI-First with Validation Foundation**

**CRITICAL DISCOVERY:** NavigationStrategyEditor is **already wired up and visible** in studio-ui (via edit-ui). Users running `yarn cli studio` can already access the "Navigation" tab - it just can't author sophisticated strategies yet. Leaving this visible-but-limited while building CLI/MCP alternatives would be confusing.

**Phase 1: Shared Validation Library** (Foundation)
- Create `packages/db/src/core/navigators/validation.ts`
- Implement config validation for all three strategy types
- Reusable by UI, CLI, and MCP implementations
- Co-locate with navigator implementations for discoverability

**Phase 2: UI Forms** (Immediate Visibility)
- Extend `NavigationStrategyEditor.vue` with strategy type selector
- Create config forms: `HierarchyConfigForm.vue`, `InterferenceConfigForm.vue`, `RelativePriorityConfigForm.vue`
- Leverage shared validation from Phase 1
- Immediately fills gap in existing visible UI

**Phase 3 (Optional): CLI Commands** (Power Users)
- Add `strategy.ts` command using Phase 1 validation
- Enables scriptable workflows and bulk operations
- Good for testing, automation, and config-as-code workflows

**Phase 4 (Optional): MCP Tools** (Agent Enablement)
- Add MCP tools using Phase 1 validation
- Enables LLM-guided config generation
- Natural extension of existing card authoring MCP infrastructure

**Rationale:**
1. **Visible UI gap** - Users can already see the Navigation tab, it needs to work properly
>>> nb: this si greenfield - there are no users
2. **Shared foundation** - Validation layer prevents duplication across UI/CLI/MCP
3. **User expectations** - Discoverable UI features should be functional
4. **Incremental value** - UI first, then power-user tools as needed
5. **Maintainable** - Single validation source of truth in `@vue-skuilder/db`

**Key Files to Create (Phase 1 - Validation Foundation):**

>>> Can we "just" use existing constructors of ContentNavigators to validate? they contain parsers that could throw informative errors.

```
packages/db/src/core/navigators/
└── validation.ts                           (NEW - ~200 LOC)
    ├── validateHierarchyConfig()
    ├── validateInterferenceConfig()
    ├── validateRelativePriorityConfig()
    └── validateStrategyConfig() (unified entry)
```

**Key Files to Create (Phase 2 - UI Forms):**

>>> desired: UI forms should be friendly w/ bulkish text input.

```
packages/edit-ui/src/components/NavigationStrategy/
├── HierarchyConfigForm.vue                 (NEW - ~200 LOC)
├── InterferenceConfigForm.vue              (NEW - ~250 LOC)
├── RelativePriorityConfigForm.vue          (NEW - ~180 LOC)
└── NavigationStrategyEditor.vue            (MODIFY - add type selector, ~50 LOC added)
```

**Key Files to Create (Phase 3 - Optional CLI):** >>> deferred
```
packages/cli/src/
├── commands/strategy.ts                    (NEW - ~200 LOC, uses validation.ts)
└── index.ts                                (MODIFY - register command)
```

**Key Files to Create (Phase 4 - Optional MCP):** >>> deferred
```
packages/mcp/src/
├── tools/create-navigation-strategy.ts     (NEW - ~100 LOC, uses validation.ts)
├── tools/list-navigation-strategies.ts     (NEW - ~80 LOC)
└── types/tools.ts                          (MODIFY - add schemas)
```

**Success Criteria:**
- [ ] Shared validation library reusable across all interfaces
- [ ] Course authors can create all three strategy types via studio-ui
- [ ] Validation catches common errors (missing tags, circular deps, invalid ranges)
- [ ] UI forms provide helpful guidance (tooltips, examples, error messages)
- [ ] Existing HARDCODED strategy creation still works (backward compatibility)

**Next Steps:**
If approved, I'll create:
1. `a.plan.md` - Detailed implementation plan for Phase 1 (Validation) + Phase 2 (UI)
2. `a.todo.md` - Phased task breakdown

---

## Questions for User

1. **Phasing**: Should we implement all three strategy types in Phase 2 (UI), or start with one (e.g., Hierarchy) as proof-of-concept?
2. **Strategy Editing**: The existing UI has a non-functional "edit" button. Should we implement editing alongside creation, or defer?
3. **CLI/MCP Priority**: After UI is done, do you want CLI commands (Phase 3) and/or MCP tools (Phase 4), or are you satisfied with UI-only?
4. **Validation Location**: Proposed location is `packages/db/src/core/navigators/validation.ts` - any objection to co-locating with navigator implementations?
