# Future Orchestration Vision

This document tracks aspirational features for the evolutionary orchestration system
that extend beyond the current implementation.

## Status: VISION / NOT STARTED

> **Prerequisite:** The core orchestration system (learnable weights, deviation-based
> distribution, gradient learning) is implemented. See `navigators-architecture.md`
> for the current architecture.

---

## Implemented (Reference)

The following are **complete** and documented in `navigators-architecture.md`:

- ✅ LearnableWeight interface with weight, confidence, sampleSize
- ✅ Deviation-based weight distribution (bell curve sampling)
- ✅ UserOutcomeRecord for tracking learning outcomes
- ✅ Gradient computation via linear regression
- ✅ Automatic weight updates based on gradient
- ✅ Observability API endpoints (6 endpoints)
- ✅ Admin dashboard in platform-ui

---

## Remaining Vision

### 1. Parameterizable / Programmable Strategies

**Goal:** Enable template-based prerequisite rules that generalize across courses.

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

**Example use cases:**
- `grade-3 & geometry` → requires `grade-2 & geometry`
- `unit-{n} & {topic}` → requires `unit-{n-1} & {topic}`
- Cross-course strategy reuse without copy-paste

**What's needed:**
1. Template syntax design
2. Variable binding and substitution
3. Rule engine to evaluate parameterized rules
4. Cross-course strategy registry

---

### 2. Self-Healing Content

**Goal:** Automatically identify learning barriers and surface them to authors.

**Barrier signals:**
- High failure rate on specific cards/tags
- ELO stagnation on specific topics
- Long dwell time before mastery
- Drop-off (users abandon at specific points)
- Cohort-wide plateau detection

**Components needed:**
1. **Barrier Detection Pipeline** — Analyze outcomes to identify stuck points
2. **Alert System** — Notify authors of identified barriers
3. **Intervention Hooks** — Enable targeted content insertion
4. **Feedback Loop** — Measure whether interventions resolve barriers

**Example flow:**
```
Detection: 40% of users fail on "long-division-with-remainders" after
           mastering "long-division-no-remainder"

Alert: "Learning barrier detected between division topics.
        Consider intermediate content for remainder concept."

Author action: Adds 5 cards on "remainder as leftover" concept

Feedback: Barrier detection re-runs, measures improvement
```

---

### 3. Cross-Course Strategy Sharing

**Goal:** Strategies that prove effective in one course can be shared and
adapted to other courses.

**Components:**
- Strategy export/import format
- Cross-course strategy registry
- Adaptation hints for tag mapping
- Reputation/effectiveness scores from source course

---

### 4. Author Incentive Mechanisms

**Goal:** Create feedback loops that reward authors for effective content.

**Potential signals:**
- User outcomes correlated with specific content
- Content utility weights (cards that consistently help)
- Barrier resolution credit

**Considerations:**
- How to attribute outcomes to specific content when many cards contribute?
- How to handle content that is effective but not "fun"?
- Privacy implications of tracking detailed content effectiveness

---

### 5. Trigger-Response Generators

**Goal:** Event-driven generators that activate under specific conditions.

```typescript
interface TriggerResponseGenerator {
  trigger: {
    condition: 'failureSpike' | 'plateau' | 'returnAfterGap' | 'frustration';
    parameters: Record<string, number>;
  };
  response: {
    mode: 'remedial' | 'confidence-building' | 'capstone';
    targetTags?: string[];
    duration?: { cards?: number; minutes?: number };
  };
}
```

**Example triggers:**
- Frustration signal (N failures in M minutes) → easier content
- Plateau detection (no ELO movement for K sessions) → challenging content
- Inactivity return (first session after gap) → review-heavy session

**What's needed:**
- Event bus / signal mechanism for strategies to observe events
- Activation state tracking ("I am currently intervening on tag T")
- Priority over base generator (preempt vs blend)
- Exit criteria (when does intervention end)

See `brainstorm-navigation-paradigm.md` for detailed exploration.

---

### 6. Cohort-Aware Calibration

**Goal:** Use population data to improve cold-start behavior.

**Applications:**
- Initial card difficulty estimates from population performance
- Initial interval estimates based on similar users
- Strategy weight priors from population effectiveness

---

### 7. LLM-Guided Selection (Experimental)

**Goal:** Use language models to interpret learner state and select content.

```
Given:
- User profile: { elo: 950, strugglingWith: ['vowel-sounds'], ... }
- Session context: { duration: 12min, cardsSeen: 8, recentFailures: 2 }
- Available cards: [...]

Select the next 5 cards and explain reasoning.
```

**Considerations:**
- Latency and cost
- Unpredictability and debugging difficulty
- When is LLM guidance worth the overhead?

---

## Design Decisions Ahead

### Centralized vs Decentralized Orchestration

**Option A: Central Orchestrator Service**
- Single service decides strategy application
- Cleaner cohort tracking
- Requires backend infrastructure

**Option B: Client-Side Orchestration**
- Each client computes its own strategy set
- Works offline
- Harder to track cohorts

**Current:** Hybrid — client computes from synced registry, outcomes reported to backend.

### Outcome Attribution

When multiple strategies are active, how do we attribute outcomes?

- All strategies get credit/blame equally?
- Weight by score contribution?
- Require isolated A/B cells?

**Current:** Equal attribution. Future work may instrument isolated testing.

---

## Related Documents

- `navigators-architecture.md` — Current implementation (complete)
- `brainstorm-navigation-paradigm.md` — Exploration of alternative mechanisms
- `todo-strategy-authoring.md` — Strategy creation tools
- `devlog/1032-orchestrator` — Implementation details