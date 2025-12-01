# TODO: Evolutionary Orchestration Vision

## Status: FOUNDATIONAL WORK COMPLETE, ORCHESTRATION NOT STARTED

> **Prerequisite:** `packages/db/docs/todo-naive-orchestration.md` — Pipeline assembly must be
> working before evolutionary selection can be layered on top. This document describes the
> "grander vision"; naive orchestration is the foundation.

This document tracks progress toward the "grander vision" of dynamic orchestration with
evolutionary pressures, as outlined in `u.3.strategic-nuggets.md`.

## The Vision (Summary)

A self-improving courseware system where:

1. **N strategies exist** — Each a hypothesis about effective content sequencing
2. **M users exist** — Each with learning goals and measurable outcomes
3. **Multi-arm bandit selection** — Strategies are applied based on confidence in their utility
4. **Evolutionary pressure** — Effective strategies propagate, ineffective ones decay
5. **Self-healing content** — System identifies barriers and incentivizes remediation

---

## Progress Assessment

### ✅ COMPLETE: Strategy Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| `WeightedCard` API | ✅ Done | Unified scored candidate model |
| `ContentNavigator` base class | ✅ Done | Extensible strategy framework |
| Delegate pattern composition | ✅ Done | Strategies can wrap/chain |
| `HierarchyDefinition` strategy | ✅ Done | Prerequisite gating |
| `InterferenceMitigator` strategy | ✅ Done | Confusable concept separation |
| `RelativePriority` strategy | ✅ Done | Utility-based content ordering |
| `SessionController` integration | ✅ Done | `getWeightedCards()` is live |
| Pipeline assembly | ❌ Not done | See `todo-naive-orchestration.md` |

**What this enables:**
- Multiple strategies can coexist and be configured per-course
- Strategies return graded suitability scores (0-1), not just binary include/exclude
- Composition allows layering strategies: `Priority(Interference(Hierarchy(ELO)))`

**What's missing for basic operation:**
- No pipeline configuration in CourseConfig (`navigationPipeline` field)
- No assembly logic to chain configured strategies
- Currently falls back to hard-coded ELO navigator

---

### 🟡 PARTIAL: Strategy State & Context

| Component | Status | Notes |
|-----------|--------|-------|
| Read user ELO (global + per-tag) | ✅ Done | Via `CourseRegistration.elo` |
| Read user history | ✅ Done | `getSeenCards()`, `getPendingReviews()` |
| Write strategy-specific state | ❌ Not done | See `todo-strategy-state-storage.md` |
| Temporal tracking | ❌ Not done | "When was tag X last introduced?" |

**Gap for evolutionary vision:**
- Strategies cannot yet persist their own learning/state
- No mechanism for tracking strategy effectiveness over time

---

### ❌ NOT STARTED: Multi-Arm Bandit Selection

The core orchestration logic described in the vision:

```
each of N strategies divides into cohorts via some hashId collision metric
  eg: h(strategyHash + slowRotationSalt) xor userHash 
      if resultant Ones are < utilityConfidence percent of total bits, 
      then include the strategy for the user
```

**What's needed:**

1. **Strategy Registry** — Central list of available strategies with metadata
2. **Utility Confidence** — Per-strategy confidence score (0-1)
3. **Cohort Assignment** — Deterministic but rotatable user-to-strategy mapping
4. **Salt Rotation** — Periodic rotation to prevent user lock-in
5. **Outcome Measurement** — Track goal achievement per cohort

**Proposed architecture:**

```typescript
interface StrategyRegistryEntry {
  strategyId: string;
  strategyType: string;
  config: unknown;
  
  // Evolutionary metadata
  utilityConfidence: number;      // 0-1, probability of usefulness
  createdAt: string;
  lastMeasuredAt: string;
  cohortSalt: string;             // Rotated periodically
  
  // Outcome tracking
  metrics: {
    usersExposed: number;
    goalAchievementRate: number;
    engagementScore: number;
    progressRate: number;
  };
}

interface Orchestrator {
  // Determine which strategies apply to this user for this session
  selectStrategies(userId: string, courseId: string): Promise<StrategyRegistryEntry[]>;
  
  // Record outcome for evolutionary learning
  recordOutcome(userId: string, strategyIds: string[], outcome: Outcome): Promise<void>;
  
  // Rotate cohort assignments
  rotateSalt(): Promise<void>;
  
  // Prune ineffective strategies
  pruneStrategies(minConfidence: number): Promise<void>;
}
```

---

### ❌ NOT STARTED: Parameterizable / Programmable Strategies

The vision describes:

```
would like to extend into parameterizable / programmable strategies. 
eg, should be able to specify deps like:
  `grade-{n}` & `geometry` -> `grade-{n+1}` & `geometry`
```

**What's needed:**

1. **Template syntax** — Pattern matching for tag relationships
2. **Variable binding** — Extract and apply variables in prerequisite rules
3. **Rule engine** — Evaluate parameterized rules against user state

**Example:**
```typescript
interface ParameterizedPrerequisite {
  pattern: "grade-{n} & {subject}";
  implies: "grade-{n+1} & {subject}";
  constraints: {
    n: { type: "number", min: 1, max: 12 },
    subject: { type: "tag-category", category: "academic-subject" }
  };
}
```

---

### ❌ NOT STARTED: Self-Healing Content

The meta-consideration from the vision:

```
- identifying learning 'barriers' where substantive portion of cohort gets stuck or abandons
- surfacing that info in a useful way
- author aims to diagnose and remedy by providing intermediate content
```

**What's needed:**

1. **Barrier Detection** — Identify cards/tags where many users get stuck
2. **Cohort Analysis** — Compare progress across strategy cohorts
3. **Alert System** — Surface barriers to authors
4. **Intervention Hooks** — Enable targeted content insertion
5. **Feedback Loop** — Measure intervention effectiveness

**Signals for barrier detection:**
- High failure rate on specific cards
- Long dwell time before mastery
- Drop-off (users abandon course at specific points)
- ELO stagnation on specific tags

---

## Roadmap to Full Vision

### Phase A: Foundation (COMPLETE ✅)

- [x] WeightedCard API
- [x] ContentNavigator framework
- [x] Core strategies (Hierarchy, Interference, RelativePriority)
- [x] SessionController integration

### Phase B: Strategy Ecosystem (IN PROGRESS 🟡)

- [ ] SRS as ContentNavigator (`todo-srs-navigator.md`)
- [ ] Strategy authoring tools (`todo-strategy-authoring.md`)
- [ ] Strategy state storage (`todo-strategy-state-storage.md`)
- [ ] Provenance/audit trail (`todo-provenance.md`)

### Phase C: Measurement Infrastructure (NOT STARTED)

- [ ] Define "learning outcome" metrics
- [ ] Instrument strategy usage per user
- [ ] Track outcome-to-strategy correlation
- [ ] Build cohort comparison views

### Phase D: Multi-Arm Bandit Orchestrator (NOT STARTED)

- [ ] Strategy registry with utility confidence
- [ ] Cohort assignment algorithm
- [ ] Salt rotation mechanism
- [ ] Confidence update rules (Bayesian or frequentist)
- [ ] Orchestrator integration with SessionController

### Phase E: Evolutionary Pressure (NOT STARTED)

- [ ] Strategy creation incentives
- [ ] Automatic strategy pruning
- [ ] Strategy mutation/variation generation
- [ ] A/B testing framework

### Phase F: Self-Healing (NOT STARTED)

- [ ] Barrier detection pipeline
- [ ] Author alerting system
- [ ] Intervention recommendation engine
- [ ] Content gap analysis

### Phase G: Programmable Strategies (NOT STARTED)

- [ ] Template syntax design
- [ ] Rule engine implementation
- [ ] Variable binding in prerequisites
- [ ] Cross-course strategy generalization

---

## Key Design Decisions Ahead

### 1. Centralized vs Decentralized Orchestration

**Option A: Central Orchestrator Service**
- Single service decides strategy application
- Cleaner cohort tracking
- Requires backend infrastructure

**Option B: Client-Side Orchestration**
- Each client computes its own strategy set
- Works offline
- Harder to track cohorts

**Recommendation:** Hybrid — client computes from synced registry, outcomes reported to backend.

### 2. Confidence Update Mechanism

**Option A: Frequentist (Simple)**
- Track success/failure counts
- Confidence = success_rate with smoothing
- Easy to implement

**Option B: Bayesian (Principled)**
- Prior belief + observed evidence
- Thompson sampling for exploration/exploitation
- More complex but theoretically sound

**Recommendation:** Start with frequentist, migrate to Bayesian if needed.

### 3. Strategy Granularity

**Question:** What counts as "a strategy" for evolutionary purposes?

- A specific `HierarchyDefinition` config? (Fine-grained)
- The `HierarchyDefinition` approach in general? (Coarse-grained)
- A specific prerequisite rule within a hierarchy? (Very fine-grained)

**Recommendation:** Start coarse (strategy type + major config), add granularity as measurement matures.

### 4. Outcome Attribution

**Question:** If a user is exposed to multiple strategies, how do we attribute outcomes?

- All strategies get credit/blame equally?
- Weight by score contribution?
- Require isolated A/B cells?

**Recommendation:** Start with equal attribution, instrument for isolated testing later.

---

## Related Documents

- `u.3.strategic-nuggets.md` — Original vision statement
- `todo-srs-navigator.md` — SRS migration
- `todo-strategy-authoring.md` — Authoring tools
- `todo-strategy-state-storage.md` — State persistence
- `todo-provenance.md` — Audit trail for transparency
- `a.2.plan.md` — Detailed implementation plan
- `a.3.todo.md` — Task tracking
- `packages/db/docs/navigators-architecture.md` — Technical architecture

---

## Summary

**Where we are:** Solid foundation. Strategies exist, compose, return scores, and are integrated
with SessionController. The infrastructure supports the vision.

**What's next:** Build the measurement and orchestration layers. The strategies can now *exist*;
we need to make them *compete* and *evolve*.

**The gap:** The evolutionary pressure mechanisms (multi-arm bandit selection, outcome measurement,
confidence updates, self-healing) are not yet implemented. This is where the "magic" of the
vision lives, and it's entirely ahead of us.