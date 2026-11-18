# Pedagogy System

Vue-Skuilder decides what a learner sees next. It combines three things:

- **ELO ratings** on learners and cards, globally and per skill (tag);
- **spaced repetition (SRS)** scheduling for reviews;
- a **navigation pipeline** of configurable strategies. The pipeline ranks new cards and
  reviews together on one scale and records why each card ranked where it did.

This page is the overview. For depth, see [Extending Navigation Strategies](../extend/navigation-strategies)
and the framework docs in `packages/db/docs/`. `navigators-architecture.md` covers the pipeline,
and `multi-tag-elo-search.md` covers per-skill selection.

## Ratings

### Learners and cards both carry ELO

```typescript
type CourseElo = {
  global: EloRank;                      // overall
  tags: { [tagID: string]: EloRank };   // per skill
  misc?: { [id: string]: EloRank };
};

type EloRank = {
  score: number;               // rating, centred around 1000
  count: number;               // responses so far
  recent?: TagPresentation[];  // per-tag evidence buffer (see below)
};
```

When a learner answers a card, both ratings move: the learner's and the card's, on the global
rating and on each of the card's graded tags. Learners' ratings track their skill, and cards'
ratings calibrate the course from everyone's responses.

A learner's rating on a tag starts at their global rating the first time that tag is graded.
It moves quickly over the first few responses.

### Tag roles

A tag's role says what it records about a learner:

| Role | Example | Effect of a response |
|---|---|---|
| `exercise` | `gpc:exercise:sh-SH` | graded: moves the learner's and the card's rating on that tag |
| `expose` | `gpc:expose:s-S` | count only: the learner saw it but wasn't tested on it |
| `intro` | `gpc:intro:sh-SH` | count only: the learner was introduced to it |
| none | `forks` | graded |

Per-skill selection (below) treats only `exercise` tags as skills by default.

### The evidence buffer

Each graded tag keeps the learner's last 12 first attempts: when, right or wrong, and the score.
Ratings mix in partial credit and the per-question speed score. The buffer gives a cleaner
"right lately?" signal, and selection reads it to tell settled skills from shaky ones.

## The evaluation contract

A card's question turns a response into an `Evaluation`:

```typescript
interface Evaluation {
  isCorrect: boolean;        // SRS: extend or reset the interval
  performance: Performance;  // ELO: how well
  fluent?: boolean;          // false: correct but too slow; SRS caps the next interval
  deferAdvance?: boolean;    // record now, advance when the view says so
}

type Performance = number | TaggedPerformance;

interface TaggedPerformance {
  _global: number;                    // [0, 1], for SRS and global ELO
  [tag: string]: number | null;       // per-tag score, or null for count-only
}
```

A spelling card can grade each part on its own. For example, `cat` spelled `kat` gives
`{ _global: 0.67, 'gpc:exercise:c-K': 0, 'gpc:exercise:a-AE': 1, 'gpc:exercise:t-T': 1 }`.

**Scoring is gain-based.** A score of 0 is a miss. Any positive score is a success, and the
score sets how big the gain is: `expected + score × (1 − expected)`. A correct answer never lowers
a learner's rating, however slow it was. A slower or assisted answer just gains less.

## Spaced repetition

- A correct answer extends a card's interval. A wrong one resets it.
- How far an interval grows depends on the card's history: streaks, lapses, and the best interval
  so far.
- A correct but non-fluent answer (`fluent: false`) brings the card back the next day.
- Due dates mean *eligible*, not *overdue*. The system keeps a healthy backlog of eligible
  reviews rather than racing it to zero, so a missed day or a busy week doesn't snowball.

## The navigation pipeline

Every time a session plans (at the start, and on each replan) it runs the course's pipeline:

```
Generate → Filter → Drop zeros → Regulate → Hints → Diversity re-rank → Select
```

| Stage | What happens |
|---|---|
| **Generate** | Generators propose up to 500 candidates in total, each scored on what is specific to its source. A card proposed by several generators keeps their mean score, plus 10% per extra generator |
| **Filter** | Each filter multiplies scores. A **gate** says "not ready yet" (prerequisites, lessons). A **signal** expresses preference (difficulty, priority, skill pressure). Gates usually penalise rather than remove, so you can still see why a card is held back |
| **Drop zeros** | Cards scored 0 leave the pool |
| **Regulate** | Balances reviews against new cards (below) |
| **Hints** | The session's one-shot hints boost, exclude or require cards. For example, a just-introduced concept's follow-up practice |
| **Diversity re-rank** | Demotes a card whose distinctive tags already appear among higher-ranked cards, so one concept or answer can't fill the head of the queue |
| **Select** | Highest scores first, up to the run's limit |

### Built-in strategies

The assembler always includes an ELO and an SRS generator and an ELO distance filter, adding
defaults if a course declares none. Everything else is opt-in, through strategy documents.

**Generators**

- **ELO**: retrieves unseen cards from a window around the learner's global rating, scored with
  random jitter so near-equal cards rotate between sessions. It also fetches a few unseen cards for
  the learner's most pressured skills, aimed below those skills' ratings (see
  [Per-skill selection](#per-skill-selection)).
- **SRS**: due reviews, scored by urgency. Urgency weighs how overdue a review is by how short its
  interval is, since a 3-day card that's 2 days late matters more than a 6-month one.
- **Prescribed**: authored curriculum targets (for example, intro cards that must eventually
  appear). It tracks whether each target has been met, raises pressure on stale ones, and can
  emit simpler support cards when a target is blocked behind prerequisites.

**Filters**

| Filter | Kind | What it does |
|---|---|---|
| ELO distance | signal | Scores how close a card's rating is to the learner's, on a smooth curve that never reaches zero. Applies to new cards and reviews alike. Intro cards pass untouched |
| Hierarchy | gate | Holds cards back until their prerequisite tags are mastered (e.g. ELO ≥ 1050 and count ≥ 20 on `multiplication-facts` before `long-division`) |
| Interference | signal | Spaces confusable concepts apart (e.g. `b` and `d`) until each is established |
| Relative priority | signal | Favours high-value tags (e.g. frequent words before rare ones) |
| Skill pressure | signal | Boosts cards on the learner's weakest or least settled skills, up to ×1.5 |
| User tag preference | signal | The learner's own boosts and penalties on tags |

Courses and apps can register their own generators and filters, such as a course's own
lesson gating.

### Regulators: new cards vs reviews

New cards and reviews compete in one ranking, so something has to keep either side from
crowding the other out. That is the regulator stage's job:

- **Review mass.** It measures the due backlog by *value*, not count: each due review is weighted
  by its urgency times what the filters made of it. That way, reviews the learner has moved well
  beyond weigh little. Above a healthy level (20), every review is lifted, more as the excess
  grows.
- **Intake.** It measures hours since a new card was last shown, counting only time when one was
  available. As that grows, new cards are lifted, but only those no gate held back. Pressure
  can't override "not ready".

### Provenance

Every card carries a trail of what each stage did to it:

```typescript
provenance: [
  { strategy: 'elo', action: 'generated', score: 0.81,
    reason: 'new card near learner ELO: distance 140 (card: 1460, user: 1600), jitter 0.810' },
  { strategy: 'eloDistance', action: 'penalized', score: 0.72, reason: '…' },
  { strategy: 'hierarchyDefinition', action: 'passed', score: 0.72, reason: 'Prerequisites met, tags: …' },
  { strategy: 'skillPressure', action: 'boosted', score: 0.94,
    reason: 'skill pressure: sh-SH shaky (7/12 right) → ×1.40' },
]
```

Sessions persist a summary of each run: selected cards and near misses, generator and filter
breakdowns, and regulator readings. The pipeline views in the admin UI render the same data.

## Per-skill selection

The per-tag ratings and buffers drive three readers. Selection and the admin per-tag ELO view
share them, so the view shows what selection is leaning on:

- **Need**: how far a skill's rating sits below the median of the learner's own skills, as a
  value from 0 to 1. The reference is the learner's own median, not their global rating, so it
  doesn't swing when the global rating moves. A skill counts once it has 8 responses.
- **Security**: from the buffer, a skill is **secure** (mostly right lately, on at least two
  days), **shaky** (enough evidence, too often wrong) or **unproven** (too little evidence).
  Courses can gate new material on how many met skills are not yet secure.
- **Pressure**: the larger of need and insecurity.

Pressure acts in two places:
- the **skill pressure filter** boosts cards on pressured skills, reviews included;
- the **ELO generator's skill fetch** reaches the easier unseen cards those skills need, which a
  window centred on the global rating would miss.

Both are bounded, so practice leans toward weak skills without turning into runs of the same
skill.

## Sessions

A session has a time budget. It draws from two queues:

- a **supply queue**: the pipeline's ranking, new cards and reviews interleaved, refreshed by
  replans;
- a **failed queue**: cards missed this session.

Missed cards come back every few draws, so remediation doesn't pile up at the end. Near the end
of the session the failed queue takes priority. Once time is up, only failed cards are served, and
the session ends when they're cleared.

**Replans** re-run the pipeline mid-session, for example after an intro card or when the supply
runs low. A replan can carry hints and a minimum number of follow-up cards. That minimum holds the
session open past the timer, so an intro's practice is still served.

## Evolutionary orchestration

Strategies can carry a **learnable weight** that is tuned from outcomes across learners:

```typescript
interface LearnableWeight {
  weight: number;       // peak, 1.0 = neutral
  confidence: number;   // 0–1; low = wide exploration
  sampleSize: number;
}
```

1. Each learner gets a stable deviation from the peak weight, from a hash. Low confidence
   spreads learners widely.
2. Learning outcomes are recorded per learner per period.
3. A periodic update correlates deviation with outcome. It moves the peak toward what worked,
   and grows confidence as the evidence agrees.

Strategies marked `staticWeight: true`, such as foundational prerequisites, are left out of this
tuning. A strategy without `learnable` runs at weight 1.

## Extension points

- **Strategies.** Write a generator (`getWeightedCards(limit, context)` returning `{ cards, hints? }`)
  or a filter (`transform(cards, context)` declaring `kind: 'gate' | 'signal'`), register it at
  app start, and add a strategy document naming it. See
  [Extending Navigation Strategies](../extend/navigation-strategies).
- **Questions.** A card type decides what counts as correct, how to score partial or slow
  answers, and which tags it grades (via `TaggedPerformance`).
- **Strategy state.** Strategies can keep per-learner state that the app also reads and writes,
  so the UI and navigation share one source of truth.

## Responsibilities

| Component | Responsibility |
|---|---|
| Questions | What a correct answer is, and how well it went, per tag |
| ELO | Learner and card ratings, global and per skill |
| SRS | When a seen card is eligible again |
| Pipeline (generators, filters, regulators) | Which card is worth showing next, and why |
| SessionController | Time budget, queues, replans, remediation |
| Orchestration | Tuning strategy weights from outcomes |

## Where this is going

- **Centring the difficulty curve.** At a gap of 0, learners fail roughly one card in three to
  five. Higher success may need the curve aimed below the learner.
- **Seen-but-not-due remediation.** Bringing back easier cards a learner has already seen, for a
  skill that is slipping.
- **Gates visible to generators**, so curriculum generators stop pushing toward cards a gate will
  block.
- **Cohort-aware cold start**: better first ratings for a learner's new skill than their global
  rating.
- **Cross-course strategy sharing.**
