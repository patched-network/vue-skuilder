# Brainstorm: Navigation Paradigm Exploration

> **Status:** Informal brainstorming. Not a design doc or TODO.

This document explores the navigation strategy paradigm: what other strategy types
might exist, where the current design shines or struggles, and what alternative
approaches could achieve similar aims.

---

## Potential Strategy Classes

### Generators (Candidate Sources)

These produce candidate cards, typically with initial scores.

| Strategy | Description | Trigger/Source |
|----------|-------------|----------------|
| **ELO** (exists) | Skill-proximity matching | Always active, scores by distance |
| **SRS** (planned) | Spaced repetition scheduling | Time-based, scores by overdueness |
| **HardcodedOrder** (exists) | Fixed sequence | Index position |
| **TriggerResponse** | Activated by specific events | See below |
| **RecentFailures** | Re-surfaces cards with recent errors | Performance signal |
| **Adaptive Drill** | Intensive repetition on weak spots | Threshold-triggered |
| **Random** | Uniform random selection | Always active (baseline) |
| **CurriculumSequence** | Author-defined learning path | Progress gates |
| **SocialSignal** | Cards others struggled with | Cohort data |

### Filters (Score Transformers)

These modify scores from upstream candidates.

| Strategy | Description | Effect |
|----------|-------------|--------|
| **HierarchyDefinition** (exists) | Prerequisite gating | Hard filter (score=0) |
| **InterferenceMitigator** (exists) | Confusable concept separation | Soft penalty |
| **RelativePriority** (exists) | Utility-based boosting | Soft boost |
| **TimeSinceTag** | Recency of tag exposure | Soft penalty/boost |
| **SessionCoherence** | Thematic consistency within session | Soft boost for related |
| **FatigueAdjuster** | Reduce difficulty as session progresses | Soft penalty for hard cards late |
| **UserPreference** | User-stated preferences/interests | Soft boost |
| **Novelty** | Freshness vs. review balance | Score adjustment |

### Trigger-Response Generators (Your Interest)

These are **event-driven generators** that activate under specific conditions:

#### Intensive Response Intervention

```
Trigger: User fails card C with tag T at mastery level M
         AND failure count on T exceeds threshold in window

Response: Generator activates
          - Surfaces remedial content for tag T
          - May include prerequisite tags
          - Runs for N cards or until success threshold

Exit: Deactivates when recovery criteria met
```

#### Other Trigger Scenarios

| Trigger | Response |
|---------|----------|
| **Frustration signal** (N failures in M minutes) | Shift to easier content, motivational material |
| **Plateau detection** (no ELO movement for K sessions) | Surface challenging content, introduce new tags |
| **Mastery celebration** (tag mastery achieved) | Capstone card, related advanced content |
| **Inactivity return** (first session after gap) | Review-heavy, confidence rebuilding |
| **Learning velocity drop** | Adjust presentation cadence, check interference |
| **Specific error pattern** (e.g., always confuses X and Y) | Targeted contrast exercises |

#### Implementation Considerations

Trigger-response generators need:
1. **Event bus / signal mechanism** — How do strategies observe events?
2. **Activation state** — How to track "I am currently intervening on tag T"?
3. **Priority over base generator** — When active, should it preempt or blend?
4. **Exit criteria** — When does intervention end?

This argues for strategies having **lifecycle state**, not just stateless scoring.
See `todo-strategy-state-storage.md` for related concerns.

---

## Hybrid Generators

Some strategies might combine generation and filtering:

| Strategy | Behavior |
|----------|----------|
| **Contextual ELO** | ELO generator that adjusts target based on session state |
| **Pacing Controller** | Generates from pool but enforces cadence rules |
| **Multi-Objective** | Balances multiple generators (ELO + SRS + Priority) |

---

## Strengths of Current Paradigm

### 1. Composability via Delegation

The delegate pattern is genuinely elegant:
```
Priority(Interference(Hierarchy(ELO)))
```

Each layer does one thing. Easy to reason about, test, and swap components.

### 2. Unified Score Semantics

Everything speaks `WeightedCard`. Scores compose multiplicatively. A hard filter
(score=0) works at any layer. Soft preferences blend naturally.

### 3. Separation of Concerns

- **Generators** know about card selection
- **Filters** know about constraints/preferences
- **SessionController** knows about time/queue management
- **No cross-cutting entanglement**

### 4. Backward Compatibility

Legacy `getNewCards()` / `getPendingReviews()` still work. Migration is incremental.

### 5. Extensibility

New strategies plug in via `ContentNavigator.create()` dynamic loading. No central
registry modification required.

---

## Weaknesses of Current Paradigm

### 1. Stateless by Default

Strategies are instantiated per-request. No persistence of:
- "I am currently running an intervention"
- "Last time I surfaced tag X was..."
- "This user responds well to strategy Y"

**Mitigation:** `todo-strategy-state-storage.md` (not implemented)

### 2. Pull-Only Model

Strategies are invoked via `getWeightedCards()`. They can't:
- React to events (card failure, session end)
- Proactively signal "I have urgent candidates"
- Coordinate across sessions

**Mitigation:** Would need event subscription / push mechanism

### 3. Limited Context Passing

Strategies receive `user`, `course`, `strategyData`. They don't receive:
- Current session state (cards seen, failures)
- Temporal context (time of day, day of week)
- User's explicit goals for this session

**Mitigation:** Expand context object passed to strategies

### 4. No Inter-Strategy Communication

Strategies can't:
- "I'm handling this, others back off"
- Share computed data (e.g., interference detection useful to multiple)
- Negotiate priority

**Mitigation:** Shared context / blackboard pattern

### 5. Pipeline Assembly Gap

(Addressed in `todo-naive-orchestration.md`)

The delegate pattern exists but isn't wired up. Each filter creates its own
delegate internally based on `serializedData`. No central orchestration.

### 6. Linear Pipeline Limitations

Current model is strictly linear: `A(B(C(D)))`. Some scenarios want:
- Parallel generators merged: `merge(ELO, SRS)`
- Conditional branches: `if frustrated then X else Y`
- Dynamic reconfiguration mid-session

---

## Alternative Mechanisms

### 1. Blackboard Architecture

Instead of a linear pipeline, strategies write to a shared "blackboard":

```
Blackboard {
  candidates: WeightedCard[]
  signals: { frustration: 0.3, velocity: 0.8, ... }
  interventions: { activeTag: 'vowel-sounds', since: ... }
  vetoes: Set<cardId>
}

Strategies read/write blackboard in phases:
1. Generators add candidates
2. Observers add signals
3. Filters modify scores
4. Interventions override/inject
5. Final selection
```

**Pros:** Richer coordination, event-driven capable
**Cons:** More complex, harder to reason about, ordering sensitive

### 2. Reactive / Event-Driven

Replace pull model with event streams:

```typescript
interface NavigationEventSource {
  onCardResult(result: CardResult): void;
  onSessionStart(session: SessionContext): void;
  onSessionEnd(stats: SessionStats): void;
}

interface ReactiveCandidateSource {
  candidates$: Observable<WeightedCard[]>;
  priority$: Observable<number>;
}
```

Strategies subscribe to events and emit candidates when they have something urgent.

**Pros:** Natural for trigger-response patterns
**Cons:** Complexity, backpressure, ordering

### 3. Rule Engine

Declarative rules instead of imperative strategies:

```yaml
rules:
  - name: interference-cooldown
    when:
      - card.tags intersects session.recentTags
      - tag.maturity < threshold
    then:
      - score *= 0.5
      
  - name: frustration-intervention
    when:
      - session.failureRate > 0.4
      - session.consecutiveFailures >= 3
    then:
      - activate: remedial-generator
      - target: session.lastFailedTag
```

**Pros:** Declarative, inspectable, author-configurable
**Cons:** Limited expressiveness, new DSL to maintain

### 4. Bandit Selection (Planned)

Instead of a fixed pipeline, select among N candidate pipelines:

```
PipelineA: ELO
PipelineB: Hierarchy(ELO)
PipelineC: Interference(Hierarchy(ELO))

Orchestrator selects pipeline per-session based on:
- User cohort
- Historical effectiveness
- Exploration/exploitation balance
```

**Pros:** Learns what works, self-improving
**Cons:** Requires outcome measurement, cold-start problem

See `todo-evolutionary-orchestration.md`.

### 5. LLM-Guided Selection

Use a language model to interpret learner state and select content:

```
Given:
- User profile: { elo: 950, strugglingWith: ['vowel-sounds'], ... }
- Session context: { duration: 12min, cardsSeen: 8, recentFailures: 2 }
- Available cards: [...]

Select the next 5 cards and explain reasoning.
```

**Pros:** Flexible, can incorporate nuance
**Cons:** Latency, cost, unpredictability, hard to debug

### 6. Constraint Satisfaction

Frame card selection as constraint satisfaction:

```
Constraints:
- At most 3 new tags per session
- No more than 2 cards from same tag consecutively  
- Prerequisite tags must be mastered
- Session should have 60% review, 40% new

Objective: Maximize expected learning gain
```

Solver finds valid card sequence.

**Pros:** Principled, globally optimal
**Cons:** Computational cost, hard to specify constraints

---

## Recommendation: Incremental Extension

Rather than wholesale paradigm shift, extend current model:

### Near-term (compatible with naive orchestration)

1. **Richer context** — Pass session state to strategies
2. **Trigger-response generator** — New generator type with activation state
3. **Session-scoped state** — Allow strategies to persist within-session

### Medium-term (with strategy state storage)

4. **Cross-session state** — Strategies remember past sessions
5. **Event hooks** — Strategies can subscribe to card results
6. **Intervention protocol** — Active intervention preempts normal generation

### Long-term (with evolutionary orchestration)

7. **Bandit selection** among pipelines
8. **Outcome measurement** for strategy effectiveness
9. **Hybrid architectures** where blackboard/reactive patterns augment pipeline

---

## Questions to Explore

1. **What's the API for trigger-response generators?**
   - `shouldActivate(sessionState): boolean`?
   - `getInterventionCandidates(): WeightedCard[]`?
   - How to represent "I am currently intervening"?

2. **How do strategies share expensive computations?**
   - E.g., tag lookups (addressed in `todo-pipeline-optimization.md`)
   - E.g., user mastery state
   - Shared context object? Memoization layer?

3. **What events should be observable?**
   - Card shown, card answered (correct/incorrect), session start/end
   - ELO change, tag mastery change
   - User-initiated actions (skip, flag, etc.)

4. **How much state is too much?**
   - Stateless is simple but limited
   - Full state enables sophisticated behavior but complexity cost
   - Right level of state for different strategy types?

---

## Related Documents

- `navigators-architecture.md` — Current architecture
- `todo-naive-orchestration.md` — Pipeline assembly (prerequisite)
- `todo-strategy-state-storage.md` — State persistence
- `todo-evolutionary-orchestration.md` — Bandit selection vision
- `todo-provenance.md` — Audit trail (transparency)