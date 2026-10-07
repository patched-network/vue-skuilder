# Summary and Recommendation: Procedural Content Generation

**Date**: 2026-01-13  
**Status**: Assessment Complete — Awaiting Direction

---

## The Problem Restated

The current framework supports:
- ✅ **Card selection** based on ELO proximity and SRS scheduling
- ✅ **Static content** stored as DisplayableData in CouchDB
- ✅ **Discrete difficulty** via per-card ELO ratings

The current framework does not support:
- ❌ **Procedural content** generated at runtime
- ❌ **Skill-level tracking** for continuous difficulty dimensions
- ❌ **Adaptive protocols** like Ericsson's n+1/n-2 method

**Concrete Example:** To implement Ericsson's digit-span experiment, we would need:
1. A way to track "current sequence length" per user
2. Content generation at that length (not DB lookup)
3. Post-response adjustment of the length parameter
4. Persistence across sessions

---

## Options Explored

| Option | Description | Effort | Fit |
|--------|-------------|--------|-----|
| **A: Procedural Generator** | New generator type that synthesizes rather than queries | Medium | Good |
| **B: Adaptive Question** | Questions with injected skill state access | Low | Good |
| **C: Skill Navigator** | Per-skill difficulty tracking as new abstraction | High | Excellent |
| **D: Continuous DataShape** | Parameterized content at selection time | Medium | Partial |
| **E: Hybrid Source** | ProceduralContentSource + SkillState | Medium-High | Excellent |

See `a.1.assessment.md` for detailed analysis of each option.

---

## Recommendation

### Primary Path: Option B (Adaptive Question) → Option E (Hybrid Source)

**Start with Option B** for rapid prototyping:
- Minimal infrastructure changes (~470 lines new, ~80 lines modified)
- Questions gain skill awareness via injected `SkillAccessor`
- Single DB card per skill serves as "anchor"
- Proves the concept with real users

**Evolve to Option E** for production scale:
- Extract adaptation logic from Questions to Sources
- Add virtual card infrastructure for true procedural content
- Gain observability (skill progression dashboards)
- Clean architectural separation

### Why This Path?

1. **Risk Mitigation**: Option B touches fewer critical paths
2. **Validation First**: Prove the Ericsson protocol works before investing in infrastructure
3. **Compatible Evolution**: SkillState format is identical in both options
4. **Time to Value**: Get adaptive content to users faster

---

## Implementation Phases

### Phase 1: Skill State Infrastructure (1 day)
- Add `SkillState` type definition
- Add adaptation protocol types (Ericsson, gradient, staircase)
- Unit tests for state updates
- **No runtime changes**

### Phase 2: Adaptive Question Framework (2 days)
- Add `SkillAccessor` interface
- Add `AdaptiveQuestion` base class
- Extend `CardHydrationService` for adaptive detection
- Integration tests with mocked skill state

### Phase 3: Digit Span Reference (2 days)
- Implement `DigitSpanQuestion`
- Implement `DigitSpanView.vue`
- E2E test demonstrating Ericsson protocol
- **First working adaptive content**

### Phase 4: FallingLetters Adaptation (1 day)
- Create `AdaptiveFallingLettersQuestion`
- Test gradient protocol for speed adjustment
- **Real content type becomes adaptive**

### Phase 5 (Optional): Evolve to Option E (3-5 days)
- Add `ProceduralContentSource` interface
- Add virtual card infrastructure
- Extract skill management from Questions to Sources
- Add observability endpoints

---

## Key Files

### New Files (Option B MVP)

| File | Lines | Purpose |
|------|-------|---------|
| `db/src/core/types/skillState.ts` | ~50 | SkillState, protocols |
| `common-ui/src/composables/SkillAccessor.ts` | ~30 | State access interface |
| `common-ui/src/composables/AdaptiveQuestion.ts` | ~100 | Base class |
| `courseware/src/memory/questions/digit-span/*` | ~190 | Reference impl |

### Modified Files

| File | Changes | Risk |
|------|---------|------|
| `CardHydrationService.ts` | +60 lines | Medium |
| `SessionController.ts` | +20 lines | Medium |
| `CompositionViewable.ts` | +40 lines | Low |

---

## Open Questions for You

1. **Session Mixing**: Should adaptive content appear in the same session as regular cards, or be a separate "mode"?

2. **Skill Visibility**: Should users see their skill level? (e.g., "Digit Span: 7")

3. **Course Author Control**: Should authors configure which adaptive skills are available in their course?

4. **History Semantics**: Should we persist records for each adaptive presentation, or only aggregate skill state?

5. **Priority**: Is digit-span a real goal, or primarily a reference for FallingLetters adaptation?

---

## Detailed Documents

| Document | Content |
|----------|---------|
| `a.1.assessment.md` | Full analysis of 5 design options |
| `a.2.architecture-sketch.md` | Detailed design for Option E |
| `a.3.alternative-adaptive-question.md` | Detailed design for Option B |
| `a.4.implementation-touchpoints.md` | Concrete code locations and modifications |

---

## Next Step

Select an approach and I'll produce:
- `a.plan.md` — Detailed implementation plan
- `a.todo.md` — Phased task checklist

Or ask clarifying questions and I'll refine the assessment.