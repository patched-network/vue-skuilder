# Assessment: Skuilder Courseware Skill

## Context

The project has an existing **MCP server** (`packages/mcp`) that provides comprehensive programmatic access to course data:
- 14 resources (config, cards, tags, shapes, schemas)
- 4 tools (create_card, update_card, tag_card, delete_card)
- 2 prompts (fill-in-card-authoring, elo-scoring-guidance)

The request is for a **skill** as a "lighter-weight access point for agentic usage." Skills differ from MCP servers: they're primarily **guidance documents** loaded into Claude's context when triggered, rather than live tool endpoints.

## What a Skill Can Provide (vs MCP)

| Capability | MCP Server | Skill |
|------------|------------|-------|
| Query course data | Yes (resources) | No - must shell out or use MCP |
| Create/modify cards | Yes (tools) | No - guidance only |
| Workflow documentation | Limited (prompts) | Full lifecycle guidance |
| CLI command reference | No | Yes |
| Authoring best practices | Partial | Comprehensive |
| DataShape examples/schemas | Yes (schema resource) | Can bundle reference docs |
| Context window cost | Minimal (on-demand) | Loaded when skill triggers |

## Options

### Option A: Guidance-Only Skill

A skill that provides **documentation and workflow guidance** without duplicating MCP functionality.

**Contents:**
- `SKILL.md` - Core procedures: when to use CLI vs MCP, workflow selection
- `references/cli-commands.md` - Complete CLI reference (init, studio, pack, unpack)
- `references/course-authoring.md` - Best practices for effective exercises, grading schemes, difficulty curves
- `references/datashapes.md` - Available shapes with examples and use cases
- `references/elo-guidelines.md` - ELO scoring strategy

**Trigger scenarios:**
- "Create a new Skuilder course"
- "Help me author courseware"
- "What question types are available in Skuilder?"

**Pros:**
- Clean separation: Skill = guidance, MCP = operations
- Lower maintenance (docs don't break)
- Skill can mention MCP for actual operations

**Cons:**
- Requires MCP server to be running for actual course operations
- Two systems to coordinate

### Option B: Hybrid Skill with Scripts

A skill with **bundled scripts** that wrap CLI and provide standalone course utilities.

**Contents:**
- `SKILL.md` - Core procedures and when to use what
- `scripts/course-info.sh` - Inspect course from static files
- `scripts/validate-card.ts` - Validate card data against schema
- `scripts/list-shapes.ts` - Extract available shapes from course
- `references/` - Same documentation as Option A

**Pros:**
- Self-contained operations for common queries
- Works without MCP server running
- Scripts can operate on static course files directly

**Cons:**
- Script maintenance burden
- Duplicates some MCP functionality
- Scripts may need dependencies (Node.js, etc.)

### Option C: MCP-Companion Skill

A skill explicitly designed as a **companion to the MCP server** - guidance on *using* the MCP.

**Contents:**
- `SKILL.md` - How to configure and connect to Skuilder MCP
- `references/mcp-resources.md` - Complete resource reference with examples
- `references/mcp-tools.md` - Tool usage patterns and validation rules
- `references/authoring-workflows.md` - Multi-step card creation workflows
- `references/course-design.md` - Higher-level course design principles

**Trigger scenarios:**
- "Connect to Skuilder MCP"
- "Help me use the Skuilder tools"
- Working in a directory with `.mcp.json` pointing to Skuilder

**Pros:**
- Leverages existing MCP investment fully
- Clear mental model: Skill teaches, MCP executes
- Can include "meta" workflows (e.g., bulk card creation patterns)

**Cons:**
- Tightly coupled to MCP server changes
- Less useful standalone

### Option D: Course Design Reference (No Operations)

A **pure documentation skill** focused on pedagogical guidance - what makes effective Skuilder courses.

**Contents:**
- `SKILL.md` - Course design principles, exercise effectiveness
- `references/question-design.md` - Effective question writing
- `references/difficulty-progression.md` - ELO strategies, spaced repetition theory
- `references/content-types.md` - When to use which DataShape
- `assets/example-cards.json` - Reference examples of well-designed cards

**Trigger scenarios:**
- "Design an effective course"
- "What makes good spaced repetition exercises?"
- "How should I structure difficulty?"

**Pros:**
- Unique value not in MCP
- Highly reusable guidance
- Doesn't duplicate any operational code

**Cons:**
- Doesn't help with actual course creation mechanics
- Needs to be paired with CLI docs or MCP for execution

## Key Considerations

1. **MCP already exists and is comprehensive** - don't reinvent tools
2. **Skills excel at guidance/documentation** - leverage this
3. **The CLI has four commands** - init, studio, pack, unpack - that deserve documentation
4. **Authoring pedagogy is under-documented** - unique skill value-add
5. **Location**: `./skill` seems cleaner than `./packages/skill` since it's not a build package

## Recommendation

**Option A (Guidance-Only) with elements of Option D (Course Design).**

Rationale:
- MCP server is mature and comprehensive for operations
- Skill should focus on **what MCP can't provide**: workflow selection, CLI usage, pedagogical guidance
- Keep it lean - progressive disclosure via `references/` files
- Clear trigger: "working with Skuilder courses" or "authoring courseware"

Proposed structure:
```
skill/
├── SKILL.md                          # ~200 lines max
│   ├── Frontmatter (name, description)
│   ├── Quick Start (CLI vs MCP decision tree)
│   ├── Workflow Overview
│   └── References index
└── references/
    ├── cli-reference.md              # init, studio, pack, unpack
    ├── course-authoring.md           # Pedagogical best practices
    ├── datashapes-catalog.md         # Available shapes with examples
    └── mcp-integration.md            # Using with MCP server
```

The skill tells Claude:
- **When** to use CLI commands vs MCP tools
- **How** to design effective courses and cards
- **What** DataShapes exist and when to use each
- **Where** to find schemas/validation (point to MCP resources)

This positions the skill as the "brain" (knowledge, guidance) and MCP as the "hands" (execution).
