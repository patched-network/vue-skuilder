# Regulator stage: balancing review and new content

Draft, 2026-09-30. Came out of a debugging conversation over LP learner data (see
[diagnostics a.4](../diagnostics/a.4.field-notes.md)). Colin's slots are marked `>>>`; Claude's
answers `↳ A:`.

**Status 2026-10-01:** steps 3–5 of the rollout are built on framework branch
`pipeline-regulation` (§5). The `↳ A:` answers below are the defaults it ships with.

Related: the July valve-contract intent (uncapped `rate^(u/scale)` valves, gated on
self-regulation) and the mission doc's Q2 (`~/pn/bd/skuilder-mission/07`, budget vs uncapped
backpressure). This note is a concrete candidate for both.

## 1. The problem

Review cards and new cards compete in one ranking (the single supplyQ). Two things set the mix
between them today:

- **SRS backlog pressure**, inside the SRS generator (`srs.ts`). It multiplies every review by
  `2^((due − 20) / 20)` once more than 20 reviews are due. (The code's rate is 2; its comments, and
  this note's first draft, said 1.5.) Uncapped, and keyed to the **count** of
  due reviews.
- **Nothing on the new side.** The ELO generator has no counter-pressure. A new card's score is its
  ELO relevance (Gaussian, about `exp(−(d/300)²)`) times a jitter, so at most 1.0.

### The cycle, as observed (Colin)

1. The backlog grows, and the scheduler gives many consecutive review-only sessions.
2. Once dug out, it flips hard, into one or two sessions with lots of new content.
3. That intake lands as a clump of first reviews due together, and a large intake is too much for
   first reviews to succeed. Failures blow the backlog up, and the cycle repeats.

### Why count is the wrong measure

The framework keeps a backlog on purpose: a **reserve lake** of eligible review content. A mature
card has a window of useful review time, not an instant, so reviews become available a little
early and reach the front of the queue a little later. Content the learner has moved beyond should
fade (lower priority, possibly never surfacing). That kills the review death spiral of traditional
SRS and the peril of an interrupted schedule.

A count treats every card in the lake as 1.0. However low its value, the lake reads as urgency.

**Field data** (LP, one learner, dump of 2026-09-30):
- 42 due. 31 of them on intervals of 14 days or more; 33 less than half an interval overdue. That
  is the lake.
- Each run serves the most urgent cards (short intervals), so the lake cards that set the count
  are served last. The count, and so the ×2.14 multiplier, never relaxes. That multiplier is why
  review top scores sat near 2.0 (0.95 × 2.14).
- New cards: about 12 a day over 09-05..09-11, then about 0 a day over 09-12..09-29.

What the same 42 cards weigh under different measures:

| Measure | Value | Multiplier (healthy 20) |
|---|---|---|
| Count (today) | 42 | ×2.14 |
| Σ SRS per-card score / 0.95 | 31.0 | ×1.46 |
| Σ SRS urgency (as built, §2.3) | 18.9 | ×1.00 |
| Σ SRS urgency × ELO distance (as built, with the default filter) | 16.3 | ×1.00 |
| Σ relative overdue, clamped to [0, 1] | 12.4 | ×1.00 |

The SRS per-card score has a floor of 0.5, so it barely discounts. The lake only drops out under a
measure whose per-card weight can approach 0.

### Two findings about the pipeline as assembled

- **LP reviews get no ELO-proximity discount.** The ELO-distance filter exists only in
  `createDefaultPipeline` (`defaults.ts`), which runs only when a course has no strategy docs. It is
  built by a factory, isn't in the navigator registry or the `Navigators` enum, and so can't be
  named by a strategy doc. Every course that configures strategies loses it. LP has done so since
  about 2026-03.
- **The default pipeline counts ELO distance twice for new cards**: once in the ELO generator's
  relevance, again in the filter. At 200 ELO points a new card keeps about 0.36 of its score and a
  review 0.56; at 300 points, 0.14 against 0.38. The further away, the more the balance tips
  toward reviews. Nobody chose that.

## 2. Proposal

### 2.1 Generators retrieve; heap-wide signals live in one filter

A generator retrieves candidates and scores them only on what is specific to its source:
- SRS: overdueness and interval recency;
- prescribed: its targets and pressure;
- ELO: a retrieval window around the learner's ELO, plus jitter for variety.

A signal that applies to every card lives in exactly one heap-wide filter. ELO distance is the
case at hand. So:
- the ELO generator emits a flat relevance (jitter only) inside its window;
- `eloDistance` becomes a registered filter navigator, so a strategy doc can declare it;
- one curve, not two (generator σ 300 against filter half-life 200, floor 0.3).

These ship **together**. LP has no ELO-distance filter today, so flattening the generator alone
would remove distance from new cards entirely.

Scoping filters to particular generators was considered and not taken:
- gates (hierarchy, lesson gate, letter gating, intro gate) have to apply to the whole heap;
  scoping them invites leaks;
- signals scoped per class make the new-vs-review comparison depend on where each signal happens to
  be applied, which is the thing this note is trying to make explicit.

>>> default-on (the assembler adds `eloDistance` the way it adds ELO and SRS generators, a course
opts out) or explicit (a course declares it)?

> **↳ A:** default-on. Flattening the generator would otherwise strip distance from every course
> that doesn't declare the filter, LP included. A course tunes it, or neutralizes it, by declaring
> its own `eloDistance` doc. One curve: the generator's Gaussian (σ 300) with a 0.05 floor, so new
> cards score as before and reviews gain the discount. `forecast` and `diagnoseCardSpace` skip it
> (`liveOnly`): they start every card at 1.0 and never applied distance.

### 2.2 A regulator stage after the filters

Regulators move out of generators into a stage of their own:

```
generators   retrieve + source-specific score
  → filters      per-card multipliers: gates and heap-wide signals (commutative, any order)
  → zero-score removal
  → REGULATORS   class-level multipliers from class aggregates
  → hints        session intent: boost / exclude / require
  → diversity re-rank → sort → top N
```

**Why a stage and not a filter.** The assembler sorts filters by name, and `Pipeline` assumes
filters are commutative per-card multipliers. A regulator depends on an aggregate of the *final*
per-card values, so it must run after every filter.

**Why before hints.** Hints are session intent (an intro's follow-up, a difficulty boost). They
should still win over pressure.

**Classes.** A card is a review if it carries `reviewID`; otherwise it is new. Cards forced in by
`requireCards` bypass the stage, as they bypass filters.

Each regulator follows the valve contract: it declares how it measures urgency `u` and when it is
servable. The framework computes `rate^(u / scale)` and applies it to the regulator's class.
Prescribed's capped valves can move here later; this note doesn't move them.

### 2.3 Review-mass valve (replaces the SRS generator's multiplier)

```
mass = Σ over due reviews of  min(1, urgency_i × (s_i / g_i))
multiplier = rate^((mass − M_healthy) / M_healthy)   when mass > M_healthy, else 1
```

- `urgency_i` is the SRS generator's urgency for the review, in [0, 1] (overdueness and interval
  recency). `s_i / g_i` is the filters' net effect on it: its post-filter, pre-regulator score over
  the score it was generated with. Every course signal (gates, priority, ELO distance) discounts
  it.
- Not `s_i / s_ref` (the first draft): the SRS score is `0.5 + 0.45 · urgency`, a fixed ranking
  offset plus urgency, so every review weighs at least ~0.6 and the lake barely discounts. On the
  09-30 dump that measure gave 26.8 (×1.27); urgency gives 16.3 (×1.00).
- `s_ref` survives as the unit for reviews without an urgency (another generator's). Mass is in
  card-equivalents, so `M_healthy` keeps the meaning of the old `healthyBacklog`.
- **Discharge on service** holds: serving a review removes it from the due set.
- **It needs every due review.** Today the SRS generator returns at most the pipeline's fetch limit
  (`sorted.slice(0, limit)`, limit 500). It should pass all due reviews, or report the total mass
  alongside its slice.

**Optional forward term (lag).** Intake today commits review load tomorrow, and the valve only sees
it once due. Adding `λ · (first reviews due within H hours)` to the mass raises pressure before the
wave arrives.

>>> `s_ref` and `M_healthy`: keep 20 card-equivalents? Forward term now, or after watching
mass alone?

> **↳ A:** `M_healthy` 20 and rate 2: the old threshold and rate, applied to mass. `s_ref` 0.95
> (the SRS generator's top per-card score), as the fallback unit only. No forward term yet; watch mass alone first. The SRS
> generator's `healthyBacklog` option is now ignored (deprecated).

### 2.4 New-card intake valve (new)

```
u = time since a new card was last served (servable time only)
multiplier = rate^(u / scale)   on the new class
```

- **Discharge on service:** the clock resets when a new card is presented. Any new card counts,
  including intro flows and required cards: the learner got new content. Because every insertion
  discharges the valve, intake is metered one card at a time, not released in a burst.
- **Servability (the leak risk).** Hierarchy gates *penalize* (×0.05), they don't remove. An
  unbounded boost would eventually lift a "not ready" card over everything, and once the active
  lessons are exhausted the valve would keep growing. So:
  - the valve boosts only **eligible** new cards: those that passed every gate;
  - the clock **freezes** while no eligible new card exists. Running out of authored content is
    exhaustion, not starvation (the stagnation definition in diagnostics a.4).

  This needs filters to declare a role: **gate** (eligibility) or **signal** (preference). A
  threshold on score loss would be a weaker substitute.
- **The clock unit.** Wall time or real sessions, never pipeline runs. Prescribed's
  `sessionsSinceSurfaced` ticks per run (`prescribed.ts:842`); that is the bug to avoid.
- **State.** "Last new card served" is derivable from card histories (first record per card). The
  frozen time is not, so the valve needs a small persisted state (strategy-state doc), or a clock
  counted only over runs that had eligible new candidates.

>>> clock unit: hours or sessions? And `scale`: how long a stall before new content should beat
an average review?

> **↳ A:** hours, ×2 per 24 servable hours. State is a strategy-state doc (`IntakeClock`):
> `lastNewAt`, closed frozen time, and the start of an open frozen stretch. It is written only on
> transitions. The clock resets when the session presents a new card (`status: 'new'`, not a
> failed-new retry), via `StudyContentSource.notePresented`. Undeclared filters count as gates.

### 2.5 Stability

- Two uncapped exponentials compare normalized urgencies in log space. Neither can be permanently
  silenced, which is the July invariant.
- **Bursts:** per-card discharge meters intake.
- **The cliff remains** when both valves sit at 1. The base scores then decide, and they are
  narrowly separated (reviews 0.57–0.95 before signals, new cards up to 1.0). Small shifts still
  flip whole sessions. The session budget (mission Q2) addresses the mix directly. This proposal may
  make it unnecessary, or may not: decide after watching it run.

>>> does mission Q2 (session budget) stay open, or is it superseded by this?

## 3. Observability

Each regulator writes its inputs to the run summary (`StudySessionRunSummary`), for example:

```
regulators: [
  { name: 'review-mass', class: 'review', urgency: 12.4, multiplier: 1.0, inputs: { due: 42, mass: 12.4 } },
  { name: 'intake', class: 'new', urgency: 31, multiplier: 1.8, inputs: { hoursSinceNew: 31, eligibleNew: 140 } },
]
```

Then a persisted run explains its own new/review mix, and E1's open question (H1: reviews outscore
an eligible pool; H2: little eligible content) is read directly from `eligibleNew`. The pipeline
view (framework admin) shows the stage like any other.

## 4. Rollout

1. Pipeline visibility: the effective pipeline as assembled, with run stats (framework branch
   `pipeline-visibility`, 2026-10-01).
2. Content and config version stamps on runs (diagnostics next step 2), so every change below has a
   before/after boundary in the data.
3. Retrieve/score split: register `eloDistance`, flatten the ELO generator. Together.
4. Regulator stage with the review-mass valve, replacing the SRS generator's multiplier.
5. Gate/signal roles on filters; the intake valve.

Steps 3–5 change prod selection. Each lands with a version stamp and is judged from the persisted
runs.

> **↳ A:** step 2 isn't built. Runs recorded by 0.2.29+ carry `regulators` and `filters[].kind`,
> which mark the era implicitly; an explicit content and config stamp is still open.
>
> **↳ A (10-01, later):** step 2 built, uncommitted (framework and LP branches `version-stamps`).
> Each run stamps a hash of the strategy docs it was assembled from and the course's
> `contentVersion`; each session stamps the framework and app versions.

## 5. As built (branch `pipeline-regulation`, 2026-10-01)

- `filters/eloDistance.ts`: `EloDistanceFilter`, registered as `eloDistance` (a `signal`,
  `liveOnly`). `defaults.ts` `createDefaultEloDistanceStrategy`; the plan and assembler add it when
  a course declares none. The default pipeline uses it too.
- `generators/elo.ts`: retrieves near the learner's ELO; scores a flat jitter in [0.5, 1]; carries
  `cardElo` so the filter needn't fetch it.
- `filters/types.ts`: `CardFilter.kind` (`gate` | `signal`) and `liveOnly`. Hierarchy is a gate;
  interference, priority, user tag preference and ELO distance are signals. LP declares its three
  gating filters.
- `regulators.ts`: the valve math and the intake clock. `Pipeline.regulate` runs after zero-score
  removal and before hints; `Pipeline.notePresented` resets the clock; the course DBs forward
  `notePresented` to their navigator.
- `generators/srs.ts`: per-card urgency only; no multiplier.
- Run records: `PipelineRunReport.regulators`, `StudySessionRunSummary.regulators`,
  `FilterImpact.kind`. Diagnostics: `regulatorText`, `pipelineRunStats().regulators`. Views: the
  run detail's regulators block; the pipeline view's Regulate stage and gate/signal chips. The
  live overlay shows review mass.
