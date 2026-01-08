# Documentation Updates Summary

This document summarizes the documentation updates made to reflect the completed evolutionary orchestration work from `devlog/1032-orchestrator`.

## In-Package Documentation (`packages/db/docs/`)

### Updated: `navigators-architecture.md`

**Changes:**
- Added overview mention of Evolutionary Orchestration layer
- Added `deviation?: number` to `StrategyContribution` interface
- Updated context building references to include orchestration context
- **Added new section: "Evolutionary Orchestration"** covering:
  - LearnableWeight interface
  - Deviation-based weight distribution
  - Outcome recording
  - Gradient learning
  - Weight update cycle
  - Observability API endpoints
  - Lifecycle description
  - Static vs learnable distinction
- Added file references for orchestration modules
- Updated related documentation links

### Created: `future-orchestration-vision.md`

New document capturing remaining vision items not yet implemented:
- Parameterizable/programmable strategies (template-based rules)
- Self-healing content (barrier detection, author alerting)
- Cross-course strategy sharing
- Author incentive mechanisms
- Trigger-response generators
- Cohort-aware calibration
- LLM-guided selection (experimental)
- Design decisions ahead

### Deleted: `todo-evolutionary-orchestration.md`

The core orchestration work (Phases 1-5) is complete. Vision items moved to `future-orchestration-vision.md`.

### Updated: `brainstorm-navigation-paradigm.md`

- Added note at top referencing implemented work
- Updated "Bandit Selection" section to reflect implementation status (now marked ✅)
- Updated "Recommendation: Incremental Extension" section with completed items
- Fixed strategy state storage references (now implemented)
- Updated related documents section

### Updated: `todo-strategy-authoring.md`

- Added related documentation section linking to current architecture docs

## Public Documentation (`docs/`)

### Updated: `learn/pedagogy.md`

**Major changes:**
- Updated vision to include "self-improving" strategies
- Added "Pipeline Architecture" section with generator/filter explanation
- Added provenance trail example
- Added generator/filter labels to built-in strategies
- **Added new section: "Evolutionary Orchestration"** covering:
  - LearnableWeight interface
  - Deviation distribution
  - Outcome recording
  - Gradient learning
  - Automatic updates
  - Lifecycle
  - Static strategies
  - Observability
- Updated architectural benefits to include orchestration layer
- Updated "Data-Driven Refinement" section
- **Updated Roadmap:**
  - Moved many items from "In Development" to "Available Now"
  - Pipeline architecture ✅
  - Evolutionary orchestration ✅
  - Observability API ✅
  - Provenance tracking ✅
  - Updated "Future Vision" with remaining items

### Updated: `introduction.md`

- Changed "Discover blended pedagogical models" status from 🟡 to ✅
- Added pipeline architecture and evolutionary orchestration to completed items
- Updated remaining items to focus on per-tag targeting, self-healing, barrier detection

### Updated: `index.md` (home page)

- Updated "Pluggable Pedagogy" feature to "Adaptive Pedagogy" with new description
- Added new feature card for "Self-Improving Strategies"

### Created: `extend/navigation-strategies.md`

New developer documentation covering:
- Overview of pipeline architecture
- WeightedCard interface
- Creating custom generators (with example)
- Creating custom filters (with example)
- Score semantics
- Strategy configuration
- Custom configuration patterns
- Strategy state storage usage
- Evolutionary orchestration integration
- Pipeline assembly
- Built-in strategies reference
- File reference

### Updated: `.vitepress/config.mts`

- Added `navigation-strategies.md` to Extend section of sidebar

## Files Structure After Updates

```
packages/db/docs/
├── brainstorm-navigation-paradigm.md  (updated)
├── future-orchestration-vision.md     (NEW)
├── navigators-architecture.md         (updated)
├── todo-nominal-tag-types.md          (unchanged)
└── todo-strategy-authoring.md         (updated)

docs/
├── extend/
│   ├── custom-cards.md
│   ├── inline-components.md
│   └── navigation-strategies.md       (NEW)
├── learn/
│   └── pedagogy.md                    (updated)
├── index.md                           (updated)
└── introduction.md                    (updated)
```

## Deleted Files

- `packages/db/docs/todo-evolutionary-orchestration.md` — Content migrated to `future-orchestration-vision.md` with remaining vision items only

## Review Notes

1. The in-package docs (`packages/db/docs/`) are now aligned with completed implementation
2. The public docs (`docs/`) reflect current capabilities accurately
3. The new `extend/navigation-strategies.md` provides developer-facing documentation for extending the navigation system
4. Pre-existing TypeScript diagnostics in `.vitepress/config.mts` are unrelated to these changes (missing dev dependencies)