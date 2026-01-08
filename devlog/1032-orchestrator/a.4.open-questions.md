# Open Questions: Evolutionary Orchestration

*Design questions to resolve before spec finalization*

---

## 1. Encompassing Representation

### 1.1 Where do encompassing relationships live?

**Context**: Encompassings are distinct from prerequisites. We need to represent them somewhere.

**Options**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. New NavigationStrategy type** | `EncompassingDefinition` strategy, similar to `HierarchyDefinition` | Consistent with existing patterns; authorable | Strategies are per-course; encompassings may be cross-course |
| **B. Tag-level metadata** | Tags declare what they encompass | Global, reusable | Tags are currently just strings; would need enrichment |
| **C. Separate relationship store** | Dedicated doc type for tag relationships | Clean separation; queryable | New infrastructure; where does it live? |
| **D. Inferred only** | No explicit representation; learn from data | No authoring burden | Cold start problem; less transparent |

**Leaning toward**: A, w/ orchestration layer pressures applied as w/ other navstrategies. D maybe in future.

### 1.2 How do encompassings interact with question type composition?

**Context**: Question types already embed other question types (e.g., `TwoDigitAddition` embeds `SingleDigitAddition`). This is implicit encompassing.

**Questions**:
- Should question types declare their encompassings explicitly?
>>> not if the type-system declares it. we ought to prefer strongly-typed inference by default.
- Should the system infer encompassings from question composition?
>>> yes
- How does this map to tags? (Question types ≠ tags currently)
>>> question types will have to attach somethign like a system-generated-tag to cards that use them? (sgt is just a regular tag, but perhaps w/ a prefix and treated differently UI wise)

This all can be future work - very useful but slightly unrelated to current Q of orchestration / evolution mechanisms.

### 1.3 Partial encompassing weights

**Context**: MA uses weights 0-1 for partial encompassings (e.g., "30% of integration-by-parts problems exercise polynomial integration").

>>> question back: that seems odd to me - wouldn't it make more sense to just label those parts problems that *do* exercise polynomial integration as being encompassers ? does the MA impl take that 0.3 and misattribute most parts problem toward reducing future work on polynomial integration, and under-attribute some other parts problems to the future work on polynomial integrations? Comes out in the wash?

**Questions**:
- Do we need partial weights, or is binary (encompasses / doesn't) sufficient to start?
- If partial, who sets the initial weight? (Author? Inferred? Default?)
- How granular? (Per tag-pair? Per card? Per question type?)


>>> Other emcompassing question-back: when an encompassed skill has been exercised, does the system "push back" its scheduled reviews? does the system even do scheduled reviews in a directly translatable way to us (eg, scheduling a specific card w/ a specific time at which it becomes eligible). side note here as well - I think skuilder has a slightly different semantic for review scheduling than normal - anki has cards scheduled for a specific day, w/ the expectation that they *get reviewed* that day. skuilder makes things *eligible for review*, with the expectation that it may or may not get reviewed according to other relative priorities, and with the expectation that the bank of cards *eligible for review* never zeros out under normal usage patterns. This pattern keeps "something relevant" always in the tank, and avoids anki death-spirals from missing a day or two here or there.

---

## 2. Credit Flow Mechanism

### 2.1 Full FIRe vs simpler approximation?

**Context**: MA's FIRe algorithm is sophisticated - credit trickles through multi-level encompassing chains, with decay. Our vector-based ELO already handles within-interaction credit.

**Options**:

| Option | Description | Complexity |
|--------|-------------|------------|
| **A. Full FIRe** | Multi-level trickle, decay, bidirectional | High |
| **B. Single-hop** | Only direct encompassings, no chaining | Medium |
| **C. Implicit via ELO dynamics** | Trust that ELO space learns encompassings | Low (already exists) |
| **D. Hybrid** | Start with C, add B when relationships are explicit | Incremental |

**Leaning toward**: Without implementing the trickle, it seems encompassing impl has no effect? I think the thing to do here is maybe to pinch the encompassing work to a different workstream? agent/encompassing ? It's not clear whether it directly impacts our main mission here.

### 2.2 When does credit flow happen?

**Options**:
- **Real-time**: On every interaction, update encompassed tags
- **Batched**: Periodically propagate credit through encompassing graph
- **On-demand**: When querying a tag's status, compute encompassing contributions

### 2.3 Bidirectional flow?

**Context**: MA has:
- Success flows **down** (advanced → encompassed)
- Failure flows **up** (simple → encompassing)

**Question**: Do we implement both directions? Just downward? Neither initially?

---

## 3. Signal & Efficiency

### 3.1 How do we measure "work invested"?

**Context**: Efficiency = progress / work. What's "work"?

**Options**:
- Cards studied (count)
- Time spent (ms)
- Weighted by difficulty (harder cards = more work)
- XP-style calibrated unit (1 unit = 1 min focused work for average user)

### 3.2 How do we measure "progress"?

**Context**: MA uses course completion %. Our system is more open-ended.

**Options**:
- ELO gain (per tag? aggregate?)
- Tags "mastered" (above threshold)
- Cards completed / total
- Goal-specific (injected from above)

**Question**: Should progress metric be configurable per-course or per-user-goal?

### 3.3 What's the "zone of desirable difficulty"?

**Context**: We want high success rate but effortful success.

**Questions**:
- What accuracy range? (70-85%? 80-95%?)
- How do we detect "effortful"? (Time to answer? Retries? Hint usage?)
- Is this configurable or universal?

---

## 4. Cohort & Exploration Mechanism

### 4.1 Bell curve vs uniform vs stratified?

**Context**: For learning strategy weights, we need users distributed across weight space.

**Options**:

| Option | Description | Tradeoff |
|--------|-------------|----------|
| **Bell curve** | Most users near peak weight, few at extremes | Natural; but edges under-explored |
| **Uniform** | Equal users at all weight values | Better exploration; most users non-optimal |
| **Stratified buckets** | Guarantee N users per weight bucket | Controlled; more complex |

>>> really like the bell curve placing that you had worked up in a prior doc

### 4.2 Cross-strategy correlation?

**Context**: If cohort seed is global, user who gets +weight on Strategy1 also gets +weight on Strategy2.

**Question**: Is this desirable ("user type" consistency) or problematic (can't isolate strategy effects)?

**Options**:
- Global seed (correlated)
- Per-strategy seed (independent)
>>> yes - both users and strategies have unique cohort-sort values. potentially, eg, hashes of their . 'global' value can be a rotating salt to prevent lock-ins
- Hybrid (some strategies share, some independent)

### 4.3 Seed rotation

**Questions**:
- How often to rotate? (Weekly? Monthly? Never?)
>>> maybe weekly?
- Does rotation disrupt learning signal?
>>> possibly, but most likely in a 'noise' way ?
- Should users be notified / aware of cohort placement?
>>> No - a implementation detail.

---

## 5. Strategy Weight Learning

### 5.1 Cold start for new strategies

**Context**: New strategy has no outcome data.

**Options**:
- Start at weight=1.0, confidence=low (aggressive exploration)
>>> seems fine
- Start at weight based on similar strategies
- Require author to set initial estimate
- Shadow mode (observe but don't affect selection) before going live

### 5.2 Update frequency

**Options**:
- After every session
- Daily batch
- Weekly batch
- On explicit trigger

**Question**: Does more frequent = better, or does it introduce noise?

### 5.3 Convergence & stability

**Questions**:
- How do we prevent oscillation?
- Minimum sample size before weight changes?
- Momentum / smoothing factor?
- When is a weight "converged" (high confidence)?

---

## 6. Attribution

### 6.1 Multiple strategies active → who gets credit?

**Context**: A session might have 5 strategies contributing to card selection. User does well. Which strategy gets credit?

**Options**:

| Option | Description |
|--------|-------------|
| **Proportional to score contribution** | Strategy that contributed 40% of card's score gets 40% of outcome credit |
| **All-or-nothing by card** | Whichever strategy "won" the card gets full credit |
| **Equal split** | All active strategies share equally |
| **Bandit-style** | Treat as multi-armed bandit, use established algorithms |

### 6.2 Session vs card-level attribution

**Question**: Do we attribute outcomes at:
- Session level (aggregate metrics)
- Card level (per-interaction)
- Both?

---

## 7. Observability & Author Feedback

### 7.1 What do authors see?

**Options**:
- Strategy weights over time
- Per-card utility scores
- Barrier content alerts
- A/B test results
- Raw outcome data

>>> can add incrementally here over time.

### 7.2 Intervention hooks

**Context**: When system detects a barrier or low-utility content, what happens?

**Options**:
- Passive: Surface in dashboard, author decides
>>> mostly this, but it's future work anyhow.
- Active: Automatically de-prioritize problematic content
- Hybrid: De-prioritize + alert author

### 7.3 Transparency to users?

**Questions**:
- Should users know which strategies are active?
>>> usually nah
- Should users know their cohort placement?
>>> not in explicit details.
- Does transparency affect behavior (Hawthorne effect)?
>>> probably. this is all "the stuff underneath".

Main transparency hook here is in navigation strategy pipeline attaching Provenance to surfaced cards. Still exists. Up to individual implentors to add other stuff.

---

## 8. Scope & Incrementality

### 8.1 What's the MVP?

**Question**: What's the smallest useful increment?

**Candidates**:
- Just static strategy weights (authorable, no learning)
- Weights + outcome recording (no learning yet)
- Weights + learning (no encompassings)
- Full encompassing + credit flow

### 8.2 What can we defer?

**Likely deferrable**:
- Full FIRe (start with simpler credit flow)
>>> yes, defer
- Cross-course encompassings
>>> yes, defer, possibly out of scope entirely
- Author reward mechanisms
>>> defer
- Complex cohort stratification

### 8.3 What's load-bearing?

**Likely essential for any increment**:
- Outcome recording (can't learn without data)
- Some form of strategy weighting
- Signal definition (what are we optimizing?)
>>> remember signal injection? can we abstract this and build the mechanisms anyway? and then later we can circle back to 

---

## 9. Technical Integration

### 9.1 Where does orchestration live?

**Options**:
- Inside `packages/db` (alongside navigators)
>>> instinct says here, although this is less and less about "the data access layer". Maybe implement and then refactor some of the more abstract content selection stuff to own package.
- New package `packages/orchestration`
- Inside `packages/express` (server-side only)

### 9.2 Storage

**Questions**:
- Where do outcome records live? (User DB? Course DB? Separate?)
- How much history to retain?
- Privacy considerations for outcome data?

### 9.3 Performance

**Questions**:
- Does credit flow add latency to card selection?
- How to batch/cache strategy weights?
- Index requirements for outcome queries?

---

## Summary: Priority Questions

These feel most critical to resolve first:

1. **Encompassing representation** (1.1) - foundational data model choice
2. **Credit flow complexity** (2.1) - drives implementation scope
3. **Signal definition** (3.1, 3.2) - what are we optimizing?
4. **MVP scope** (8.1) - what do we build first?

---

*Add questions as they arise. Mark resolved with ✓ and link to decision.*
