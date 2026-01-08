# Assessment: A/B Engine Coordination System

## Summary

The codebase has a **solid foundation** for strategy execution but **no orchestration layer**. The gap is between "strategies that run" and "strategies that compete, adapt, and evolve."

**Key missing piece**: A coordination mechanism that selects, weights, and evaluates strategies across users—turning the current static pipeline into a dynamic "market" or "ecology" of competing approaches.

---

## Current State

### What Works (Phase A Complete)

| Component | Status | Location |
|-----------|--------|----------|
| Pipeline architecture | ✅ | `core/navigators/Pipeline.ts` |
| Generator/Filter composition | ✅ | `core/navigators/PipelineAssembler.ts` |
| Provenance audit trail | ✅ | Every `WeightedCard` tracks all scoring decisions |
| Strategy state storage | ✅ | `STRATEGY_STATE` docs in user DB |
| Strategy CRUD | ✅ | `NavigationStrategyManager` interface |
| CompositeGenerator | ✅ | Merges multiple generators with aggregation modes |
| ELO/SRS generators | ✅ | Working candidate producers |
| Hierarchy/Interference/Priority filters | ✅ | Working score transformers |

### What's Missing (Phase B-G Not Started)

| Gap | Impact |
|-----|--------|
| **No weight parameters on strategies** | Can't tune strategy influence without code changes |
| **No cohort assignment** | All users get identical strategy sets |
| **No outcome measurement** | Can't know which strategies work |
| **No confidence/utility tracking** | Can't prioritize effective strategies |
| **No dynamic selection** | Can't A/B test or evolve strategies |

---

## The Core Problem

Today, `CourseDB.createNavigator()` returns:
```typescript
// Pseudocode
const strategies = await getAllNavigationStrategies();
const pipeline = await PipelineAssembler.assemble(strategies);
return pipeline; // Same for ALL users
```

The vision calls for:
```typescript
// Pseudocode
const strategies = await getAllNavigationStrategies();
const userVariant = await orchestrator.getUserCohort(user, course);
const selectedStrategies = await orchestrator.select(strategies, userVariant);
const weightedStrategies = applyWeights(selectedStrategies, userVariant);
const pipeline = await PipelineAssembler.assemble(weightedStrategies);
// Track this session for outcome measurement
await orchestrator.recordExposure(user, selectedStrategies);
return pipeline;
```

---

## Options

### Option A: Minimal Weights (Quick Win, No Orchestration)

Add a `weight` field to `ContentNavigationStrategyData` that acts as a global multiplier on filter effects and generator scores.

**Changes:**
1. Extend `ContentNavigationStrategyData`:
   ```typescript
   interface ContentNavigationStrategyData {
     // ... existing fields
     weight?: number; // Default 1.0, range [0, 2]
   }
   ```

2. Modify `Pipeline.applyFilters()` to incorporate weight:
   ```typescript
   // Current: newScore = card.score * multiplier
   // Proposed: newScore = card.score * (1 + (multiplier - 1) * strategy.weight)
   ```

3. Modify `CompositeGenerator.aggregateScores()` to weight generator contributions.

**Pros:**
- Simple, minimal code changes
- Immediately tunable via existing strategy editor
- Non-breaking (weight defaults to 1.0)

**Cons:**
- Static—same weight for all users
- No A/B testing capability
- No evolutionary pressure
- Doesn't address the "market" vision

**Effort:** Low (1-2 days)

---

### Option B: Cohort-Based Strategy Selection (A/B Testing Foundation)

Add an `Orchestrator` layer that assigns users to cohorts and selects strategy subsets per cohort.

**New Components:**

1. **StrategyVariant document type**:
   ```typescript
   interface StrategyVariant {
     _id: `STRATEGY_VARIANT-${string}`;
     strategyId: string;           // Ref to NAVIGATION_STRATEGY
     weight: number;               // Influence multiplier
     cohortBits: number;           // Bits for cohort mask
     cohortSalt: string;           // Rotatable
     utilityConfidence: number;    // 0-1, Bayesian prior
     enabled: boolean;
   }
   ```

2. **CohortAssigner** service:
   ```typescript
   class CohortAssigner {
     // Hash-based deterministic assignment
     isUserInCohort(userId: string, variant: StrategyVariant): boolean {
       const hash = fnv1a(userId + variant.cohortSalt);
       const threshold = Math.floor(variant.utilityConfidence * MAX_HASH);
       return hash < threshold;
     }
   }
   ```

3. **Orchestrator** integration in `createNavigator()`:
   ```typescript
   const variants = await getStrategyVariants();
   const selectedStrategies = variants
     .filter(v => v.enabled && cohortAssigner.isUserInCohort(user.id, v))
     .map(v => ({ ...v.strategy, weight: v.weight }));
   ```

**Pros:**
- Enables A/B testing without code changes
- Deterministic (user sees consistent experience)
- Salt rotation prevents user lock-in
- Foundation for utility confidence updates

**Cons:**
- More complex than Option A
- Requires new document type and migration path
- No automatic utility updates (manual confidence tuning)

**Effort:** Medium (1-2 weeks)

---

### Option C: Multi-Arm Bandit Orchestrator (Full Evolutionary Engine)

Complete the vision: strategies compete, confidence auto-updates based on outcomes.

**New Components (building on Option B):**

1. **OutcomeRecorder** in `SessionController`:
   ```typescript
   // After each session, record:
   await orchestrator.recordOutcome({
     userId,
     strategyIds: session.activeStrategies,
     metrics: {
       cardsStudied: session.cardCount,
       accuracy: session.correctRate,
       eloGain: session.endElo - session.startElo,
       sessionDuration: session.durationMs,
       goalProgress: computeGoalDelta(user, session),
     }
   });
   ```

2. **ConfidenceUpdater** (Bayesian or frequentist):
   ```typescript
   // Periodically or after N sessions:
   for (const variant of variants) {
     const outcomes = await getOutcomes(variant.strategyId, window);
     const newConfidence = updateConfidence(
       variant.utilityConfidence,
       outcomes.successRate,
       outcomes.sampleSize
     );
     await updateVariant(variant, { utilityConfidence: newConfidence });
   }
   ```

3. **BarrierDetector** (self-healing hook):
   ```typescript
   // Identify cards/tags where cohorts stall
   const barriers = await detectBarriers({
     minStallDuration: 7 * DAY,
     minAffectedUsers: 10,
     successRateThreshold: 0.3,
   });
   // Surface to authors via dashboard or notifications
   ```

4. **ExplorationPolicy** (Thompson sampling or epsilon-greedy):
   ```typescript
   selectStrategies(variants: StrategyVariant[], userId: string) {
     // Balance exploitation (high confidence) with exploration (uncertainty)
     return variants.filter(v => {
       if (Math.random() < EPSILON) return true; // Explore
       return cohortAssigner.isUserInCohort(userId, v); // Exploit
     });
   }
   ```

**Pros:**
- Fully autonomous improvement
- Self-healing content identification
- True "market" dynamics for strategies
- Aligns with long-term vision

**Cons:**
- Significant implementation effort
- Requires outcome measurement infrastructure
- Needs goal/progress tracking to be meaningful
- Risk of complexity (simpler may be better for now)

**Effort:** High (4-8 weeks, phased)

---

### Option D: Hybrid Incremental (Recommended Path)

Combine Option A's quick wins with a non-breaking migration toward Option C.

**Phase 1: Static Weights (Week 1)**
- Add `weight` field to `ContentNavigationStrategyData`
- Implement weight application in Pipeline
- Update strategy editor UI with weight slider
- No migration needed (defaults to 1.0)

**Phase 2: Cohort Assignment (Weeks 2-3)**
- Add `StrategyVariant` document type
- Implement `CohortAssigner` with hash-based selection
- Extend `createNavigator()` to filter by cohort
- Initial confidence = manual (admin sets based on intuition)
- Salt rotation via cron or manual admin action

**Phase 3: Outcome Tracking (Weeks 4-5)**
- Instrument `SessionController` to record strategy exposure
- Define outcome metrics (ELO gain, accuracy, session completion)
- Store in `STRATEGY_OUTCOME` documents (aggregated, not per-session)
- Build simple cohort comparison view

**Phase 4: Confidence Updates (Week 6+)**
- Implement frequentist confidence updater (success rate smoothing)
- Add exploration policy (epsilon-greedy initially)
- Dashboard for monitoring strategy performance

**Phase 5: Self-Healing Hooks (Future)**
- Barrier detection pipeline
- Author notification system
- Intervention recommendation engine

**Pros:**
- Delivers value at each phase
- Non-breaking progression
- Can pause after any phase
- Tests assumptions before big investment

**Cons:**
- Slower to full vision
- Incremental complexity growth

---

## Weight Semantics (All Options)

The user specifically asked about adjusting *weights*. Here's how weight would work across strategies:

### For Filters (Multipliers)

Current behavior:
```
newScore = card.score * multiplier
```

With weight:
```
effectiveMultiplier = 1 + (multiplier - 1) * weight
newScore = card.score * effectiveMultiplier
```

| Multiplier | Weight | Effective | Effect |
|------------|--------|-----------|--------|
| 0.5 | 1.0 | 0.5 | Normal 50% penalty |
| 0.5 | 0.5 | 0.75 | Half the penalty |
| 0.5 | 0.0 | 1.0 | No penalty (disabled) |
| 0.5 | 2.0 | 0.0 | Double the penalty |
| 1.5 | 1.0 | 1.5 | Normal 50% boost |
| 1.5 | 0.5 | 1.25 | Half the boost |

### For Generators (Aggregation)

In `CompositeGenerator`, weight affects contribution to aggregate:
```
weightedScore = generatorScore * weight
finalScore = sum(weightedScores) / sum(weights)
```

### For Hard Filters (score → 0)

Weight could modulate hard filters into soft filters:
```
// weight=1.0: hard filter (score = 0)
// weight=0.5: soft filter (score = originalScore * 0.5)
// weight=0.0: disabled (pass through)
effectiveScore = weight === 1.0 ? 0 : card.score * (1 - weight)
```

---

## Migration Considerations

### Non-Breaking Path

1. **New fields optional**: `weight` defaults to `1.0` (no change)
2. **New documents additive**: `StrategyVariant` lives alongside `ContentNavigationStrategyData`
3. **Fallback to current behavior**: If no variants exist, use all strategies (current behavior)
4. **Provenance extended, not replaced**: Add cohort/variant info to provenance

### Database Impact

- **Course DB**: New `STRATEGY_VARIANT` documents (~1 per strategy)
- **User DB**: `STRATEGY_OUTCOME` aggregates (~1 per user per course, updated periodically)
- **No schema migrations**: CouchDB is schema-less

### API Compatibility

- `NavigationStrategyManager` interface extended (new methods, not changed signatures)
- `createNavigator()` signature unchanged
- `Pipeline` signature unchanged
- `WeightedCard` extended with optional cohort metadata

---

## Risk Analysis

| Risk | Mitigation |
|------|------------|
| Complexity creep | Phase gating; can stop after any phase |
| Poor outcome metrics | Start with simple metrics (ELO gain, session completion) |
| A/B test pollution | Deterministic cohort assignment; long measurement windows |
| Over-optimization | Epsilon-greedy exploration; salt rotation |
| Author confusion | Clear docs; "advanced" feature gating |

---

## Comparison Matrix

| Criterion | A: Weights | B: Cohorts | C: Full MAB | D: Hybrid |
|-----------|------------|------------|-------------|-----------|
| Time to value | Days | 1-2 weeks | 4-8 weeks | Incremental |
| Breaking changes | None | Minimal | Moderate | None |
| A/B testing | No | Yes | Yes | Yes (Phase 2) |
| Auto-adaptation | No | No | Yes | Yes (Phase 4) |
| Weight control | Yes | Yes | Yes | Yes |
| Complexity | Low | Medium | High | Medium |
| Matches vision | Partially | Mostly | Fully | Fully (over time) |

---

## Recommendation

**Option D: Hybrid Incremental**

Rationale:
1. **Immediate value**: Weights in Phase 1 unlock manual tuning
2. **Non-breaking**: Each phase is additive
3. **Validates assumptions**: Outcome tracking (Phase 3) will reveal whether A/B testing adds real value
4. **Flexible exit**: Can pause after Phase 2 if cohort-based selection proves sufficient
5. **Vision-aligned**: Full evolutionary engine is reachable but not required upfront

### Suggested Starting Point

Begin with **Phase 1 (Static Weights)** because:
- It's the user's explicit request ("adjusting weights of a given strategy")
- It's immediately useful for manual tuning
- It's completely non-breaking
- It establishes the weight semantics that later phases will use

If Phase 1 proves valuable, proceed to Phase 2 (Cohort Assignment) to enable proper A/B testing. The subsequent phases can be prioritized based on observed needs.

---

## Next Steps (Pending User Selection)

1. User reviews this assessment
2. User selects approach (or requests modifications)
3. If selection made: create `a.2.plan.md` detailing specific implementation for chosen approach
4. If clarification needed: discuss and refine assessment
