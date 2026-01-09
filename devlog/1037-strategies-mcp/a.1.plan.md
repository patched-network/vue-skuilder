# Plan: Add Navigation Strategy Support to MCP Server

**Status: IMPLEMENTED** - All phases complete. Build successful.

## Context

The MCP server currently exposes comprehensive access to course content (cards, tags, shapes, schemas) but provides **zero** access to navigation strategies. Since strategies are a core part of the adaptive learning system, this is a significant gap for agents building or configuring courses.

The `@vue-skuilder/db` package already has the necessary infrastructure:
- `NavigationStrategyManager` interface with CRUD methods
- `ContentNavigationStrategyData` type definition
- Strategy implementations (generators: ELO, SRS, HardcodedOrder; filters: Hierarchy, Interference, Priority, etc.)
- `PipelineAssembler` for runtime composition

## Goal

Expose navigation strategy management through MCP resources and tools, enabling agents to:
1. Discover what strategies exist in a course
2. Understand strategy configuration and purpose
3. Discover valid strategy types and their expected configurations
4. Create new custom strategies

**Out of scope (by design):**
- Update strategies (ineffectual strategies are managed out by AB/evolutionary engine)
- Delete strategies (same reasoning - soft deprecation via pipeline config)

---

## Implementation Plan

### Phase 1: Resources for Strategy Discovery

Add **5 new resources** to expose strategy data:

#### 1.1 `strategies://all` - List All Strategies

**Purpose:** Enumerate all navigation strategies in the course

**Data returned:**
```typescript
{
  strategies: Array<{
    _id: string;           // e.g., "NAVIGATION_STRATEGY-elo-default"
    name: string;          // Human-readable: "ELO Navigator (default)"
    description: string;   // Purpose and behavior
    implementingClass: string;  // "elo", "srs", "hierarchyDefinition", etc.
    role: 'generator' | 'filter' | 'unknown';  // Derived from NavigatorRoles lookup
    hasLearnableWeight: boolean;    // True if evolutionary tuning enabled
    staticWeight: boolean;          // True if weight is fixed
  }>
}
```

**Implementation:**
- Call `courseDB.getAllNavigationStrategies()`
- Map each strategy to include derived `role` by looking up `implementingClass` in `NavigatorRoles`
- Return `role: 'unknown'` for unrecognized implementing classes (plugin extensibility)
- Omit `serializedData` from summary view (available in detail resource)

**File:** `packages/mcp/src/resources/strategies.ts`

#### 1.2 `strategies://{strategyId}` - Strategy Detail

**Purpose:** Full configuration details for a specific strategy

**Data returned:**
```typescript
{
  strategy: ContentNavigationStrategyData;  // Complete document
  role: 'generator' | 'filter' | 'unknown';
  parsedConfig?: object;  // Attempt to parse serializedData as JSON
}
```

**Implementation:**
- Call `courseDB.getNavigationStrategy(strategyId)`
- Include complete document with `serializedData`
- Attempt JSON.parse on `serializedData` and include as `parsedConfig` if valid
- Look up role from `NavigatorRoles`, return `'unknown'` if not found

**File:** `packages/mcp/src/resources/strategies.ts`

#### 1.3 `strategies://role/{roleType}` - Filter by Role

**Purpose:** List strategies by type (generator or filter)

**Parameters:** `roleType` = `"generator"` | `"filter"`

**Data returned:**
```typescript
{
  role: 'generator' | 'filter';
  strategies: Array<{
    _id: string;
    name: string;
    description: string;
    implementingClass: string;
    hasLearnableWeight: boolean;
    staticWeight: boolean;
  }>;
}
```

**Implementation:**
- Call `getAllNavigationStrategies()`
- Filter by looking up each `implementingClass` in `NavigatorRoles`
- Return only strategies matching requested role
- Excludes strategies with `role: 'unknown'`

**File:** `packages/mcp/src/resources/strategies.ts`

#### 1.4 `strategies://roles` - Available Strategy Types

**Purpose:** List valid `implementingClass` values agents can use when creating strategies

**Data returned:**
```typescript
{
  roles: Array<{
    implementingClass: string;  // e.g., "elo", "srs", "hierarchyDefinition"
    role: 'generator' | 'filter';
    description: string;        // Human-readable description of what this type does
  }>
}
```

**Implementation:**
- Export `NavigatorRoles` registry from `@vue-skuilder/db`
- Map to include human-readable descriptions
- Descriptions can be hardcoded initially, or derived from strategy class metadata if available

**File:** `packages/mcp/src/resources/strategies.ts`

#### 1.5 `strategies://schema/{implementingClass}` - Config Schema

**Purpose:** Expose expected `serializedData` structure for a given implementing class

**Parameters:** `implementingClass` = valid NavigatorRoles key

**Data returned:**
```typescript
{
  implementingClass: string;
  role: 'generator' | 'filter';
  schema?: object;         // JSON Schema if available
  example?: object;        // Example config object
  description: string;     // What this config controls
  fields?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    default?: unknown;
  }>;
}
```

**Implementation:**
- Maintain a registry mapping `implementingClass` to schema/example
- Initially can be hardcoded based on existing TypeScript interfaces
- Return 404 or `{ available: false }` for unknown classes

**File:** `packages/mcp/src/resources/strategies.ts`

---

### Phase 2: Tool for Strategy Creation

Add **1 new tool** for creating strategies:

#### 2.1 `create_strategy` Tool

**Purpose:** Create a new navigation strategy

**Input Schema:**
```typescript
{
  name: string;              // Required, human-readable
  description: string;       // Required, explains purpose
  implementingClass: string; // Required, must be valid NavigatorRoles key
  serializedData?: string;   // Optional JSON config
  learnable?: {              // Optional evolutionary tuning
    weight: number;
    confidence: number;
    sampleSize: number;
  };
  staticWeight?: boolean;    // Default false
}
```

**Validation:**
- `implementingClass` must exist in `NavigatorRoles` (strict validation for creation)
- `serializedData` must be valid JSON if provided
- `learnable.weight` must be > 0
- `learnable.confidence` must be 0-1

**ID Generation:**
1. Generate base ID: `NAVIGATION_STRATEGY-${implementingClass}-${sanitize(name)}`
2. If collision detected, auto-append timestamp suffix: `...-${Date.now()}`
3. This ensures unique IDs while keeping them human-readable

**Implementation:**
1. Validate `implementingClass` against `NavigatorRoles`
2. Generate `_id`, checking for collision and appending suffix if needed
3. Construct `ContentNavigationStrategyData` document
4. Call `courseDB.addNavigationStrategy(data)`
5. Return created strategy ID and summary

**Output:**
```typescript
{
  success: true;
  strategyId: string;
  message: "Created generator strategy: Custom ELO Navigator"
}
```

**File:** `packages/mcp/src/tools/create-strategy.ts`

---

### Phase 3: Integration and Testing

#### 3.1 Register Resources

Update `packages/mcp/src/resources/index.ts`:
```typescript
export const RESOURCE_PATTERNS = {
  // ... existing patterns
  STRATEGIES_ALL: 'strategies://all',
  STRATEGIES_SPECIFIC: 'strategies://{strategyId}',
  STRATEGIES_ROLE: 'strategies://role/{roleType}',
  STRATEGIES_ROLES: 'strategies://roles',
  STRATEGIES_SCHEMA: 'strategies://schema/{implementingClass}',
} as const;

export * from './strategies.js';
```

Update `packages/mcp/src/server.ts` to register all five resources in `setupCapabilities()`.

#### 3.2 Register Tool

Update `packages/mcp/src/tools/index.ts`:
```typescript
export const TOOL_PATTERNS = {
  // ... existing patterns
  CREATE_STRATEGY: 'create_strategy',
} as const;

export * from './create-strategy.js';
```

Update `packages/mcp/src/server.ts` to register the tool.

#### 3.3 Create Type Definitions

Add `packages/mcp/src/types/strategies.ts`:
```typescript
import { z } from 'zod';

export const LearnableWeightSchema = z.object({
  weight: z.number().positive(),
  confidence: z.number().min(0).max(1),
  sampleSize: z.number().int().nonnegative(),
});

export const CreateStrategyInputSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  implementingClass: z.string(),
  serializedData: z.string().optional(),
  learnable: LearnableWeightSchema.optional(),
  staticWeight: z.boolean().optional(),
});

export type CreateStrategyInput = z.infer<typeof CreateStrategyInputSchema>;
```

#### 3.4 Testing with MCP Inspector

Manual test scenarios:

1. **List strategies:** Access `strategies://all` and verify all built-in strategies appear
2. **Filter by role:** Access `strategies://role/generator` and `strategies://role/filter`
3. **Discover types:** Access `strategies://roles` and verify all NavigatorRoles appear
4. **Get schema:** Access `strategies://schema/elo` and verify config structure returned
5. **View detail:** Access `strategies://{id}` for an existing strategy
6. **Create strategy:** Use `create_strategy` to add a new strategy
7. **Verify creation:** Check `strategies://all` includes new strategy
8. **Test collision:** Create strategy with same name, verify suffix added

**Success criteria:**
- All resources return valid JSON
- Tool validates inputs correctly
- Invalid `implementingClass` values are rejected with helpful error
- `serializedData` JSON parsing works
- Created strategies appear in `strategies://all`
- ID collision handling works (auto-suffix)
- Unknown implementing classes show `role: 'unknown'` in resources

#### 3.5 Update MCP CLAUDE.md Documentation

Add to `packages/mcp/CLAUDE.md`:

**Resources section:**
```
- `strategies://all` - List all navigation strategies
- `strategies://{strategyId}` - Specific strategy detail with parsed config
- `strategies://role/{roleType}` - Filter strategies by role (generator/filter)
- `strategies://roles` - List valid strategy types (implementingClass values)
- `strategies://schema/{implementingClass}` - Config schema for strategy type
```

**Tools section:**
```
- `create_strategy` - Create new navigation strategy with configuration
```

---

## Success Criteria

1. All 5 resources return valid, well-structured data
2. `create_strategy` tool validates inputs and creates strategies
3. `NavigatorRoles` validation prevents invalid strategy types on create
4. Unknown implementing classes handled gracefully in read operations (`role: 'unknown'`)
5. JSON parsing of `serializedData` succeeds for valid configs
6. ID collision auto-suffix prevents creation failures
7. Created strategies can be used with `PipelineAssembler`
8. MCP Inspector successfully tests all resources and tool
9. Documentation updated with new capabilities

---

## Known Risks

### Risk 1: Config Schema Maintenance

**Issue:** Strategy config schemas must be maintained separately from TypeScript interfaces.

**Mitigation:**
- Start with hardcoded schemas for existing strategies
- Document that schemas may lag behind implementation
- Consider code generation from TypeScript interfaces (future)

### Risk 2: Invalid Strategy Configurations

**Issue:** Agents might create strategies with invalid `serializedData` that cause runtime errors.

**Mitigation:**
- Validate JSON structure in tool
- Provide schemas via `strategies://schema/{class}` resource
- Invalid configs fail at PipelineAssembler time with descriptive errors

---

## File Checklist

### New Files
- [x] `packages/mcp/src/resources/strategies.ts` - All 5 resource handlers
- [x] `packages/mcp/src/tools/create-strategy.ts` - Create tool
- [x] `packages/mcp/src/types/strategies.ts` - Zod schemas and types

### Modified Files
- [x] `packages/mcp/src/resources/index.ts` - Export new resources and patterns
- [x] `packages/mcp/src/tools/index.ts` - Export new tool and pattern
- [x] `packages/mcp/src/types/index.ts` - Export new types
- [x] `packages/mcp/src/server.ts` - Register resources and tool
- [x] `packages/mcp/CLAUDE.md` - Document new capabilities

---

## Resolved Questions

| Q# | Question | Decision |
|----|----------|----------|
| Q1 | MVP vs Full CRUD? | Full CRUD approach, but scoped to create-only (no update/delete) |
| Q2 | `strategies://roles` in scope? | Yes - implied by Q7 (need to know valid classes) |
| Q3 | Delete method? | No delete tool - strategies managed out by AB engine |
| Q4 | ID collision? | Auto-append timestamp suffix on collision |
| Q5 | Unknown implementingClass (resources)? | Return with `role: 'unknown'` (permissive) |
| Q5 | Unknown implementingClass (tools)? | Strict validation - reject unknown classes |
| Q6 | Update semantics? | Drop `update_strategy` - same reasoning as Q3 |
| Q7 | serializedData guidance? | Add `strategies://schema/{class}` resource |
| Q8 | `strategies://role/{roleType}`? | Keep (convenience for agents) |
