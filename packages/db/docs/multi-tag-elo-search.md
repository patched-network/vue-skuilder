# Multi-tag ELO: per-skill selection

**Status (2026-11-18):** reference. Describes what is built. Design history and the evidence behind
each constant live in `agent/per-tag-elo/` (a.1 design, a.2 evidence, a.3 plan), which is a
working record and may lag. Where they disagree with the code, the code wins; fix this page.

**Audience:** framework maintainers and course authors. The mechanism is course-agnostic.
Letterspractice (LP) appears only as the worked example.

## 1. The goal

A learner is not one skill. Selection should notice which of a learner's skills are behind
the others, practise those more, and reach the easier cards they need. Difficulty matching
against the learner's single global rating can't do any of that alone.

## 2. What the data holds

`CourseElo` (`common/src/elo.ts`) has three parts, on both the learner and the card:

```ts
type CourseElo = {
  global: EloRank;
  tags: { [tag: string]: EloRank };  // per skill
  misc?: { [id: string]: EloRank };
};
type EloRank = { score: number; count: number; recent?: TagPresentation[] };
```

- **Per-tag ratings.** Grading updates every key in a card's `elo.tags`
  (`db/src/study/services/EloService.ts`), and a card's tags are seeded at deploy time by the
  course.
- **A learner's tag rating starts at their global rating** the first time the tag is graded. So
  a new skill does *not* look easy. Centring retrieval on its rating gives the same window as
  centring on global. (An earlier version of this page assumed otherwise.) Ratings move fast
  over the first ~8 responses and say little before that.
- **Evidence buffer.** `recent` holds up to 12 first-attempt presentations per tag (`at`, `ok`,
  `perf`, `card`, and `tagOk` for a per-grapheme verdict). It has no timing score, so it reads
  right and wrong cleanly where the rating mixes in speed.
- **Tag roles** (`common/src/tagRoles.ts`): only `exercise`-role tags count as skills by default.
  A course without them gets none of the behaviour below.

## 3. How selection uses it

Three readers of the learner's per-tag data. All are pure, in `common`, so selection and the
admin view compute the same numbers.

| Reader | Question | Rule (defaults) |
|---|---|---|
| `skillNeed` (`common/src/skillNeed.ts`) | Which skills are behind the learner's others? | Skills = selected tags with `count ≥ 8`; reference = **median** of their ratings (the learner's own, so it doesn't swing with global); need = clamp((median − rating) / 150, 0, 1). Fewer than 5 skills: no need anywhere |
| `tagSecurity` / `courseSecurity` (`common/src/tagSecurity.ts`) | Is a skill settled? | From the buffer: **secure** (≥ 6 first attempts, ≥ 75% right of the last 12, right on ≥ 2 local days), **shaky** (enough evidence, too few right), **unproven** (too little) |
| `skillPressures` (`db/.../filters/skillPressure.ts`) | How hard should selection lean on a skill? | pressure = max(need, shaky 0.8 / unproven 0.5), 0–1 |

`TagSelector` (`include` / `exclude` prefixes, `roles`) is shared by all three, and so by every
strategy below, so a course names its skill set once in the same form everywhere.

They act in two pipeline stages:

```
generators ──► hydrate tags ──► filters ──► regulators ──► diversity re-rank ──► top N
   │                              │
   ELO: global window             skillPressure: ×(1 + 0.5·pressure)
      + skill fetch                on the card's most pressured tag
```

- **`skillPressure` filter** (signal). Multiplies a card's score by `1 + gain · pressure` for its
  most pressured tag, the max over its tags and never the product. With the default `gain` 0.5 the
  cap is ×1.5. It acts on the whole candidate heap, reviews included, so under a review backlog it
  first changes *which reviews* are served. Opt-in: a course declares a `skillPressure` strategy
  doc. The bound matters: the diversity re-rank's floor is ×0.30, so stacked boosts above ~×3.3
  bring back same-tag runs.
- **Skill fetch, in the ELO generator** (`db/.../generators/elo.ts`). A filter can only re-weight
  cards some generator retrieved, and the global window, centred on the learner's global rating,
  doesn't reach the easier cards a weak skill needs. So the generator also takes the top
  `maxSkills` (3) skills by pressure, and for each one:
  - takes the skill's unseen card ids from the tag index (`generators/cardsByTag.ts`, shared with
    the prescribed generator), leaving out cards already in the window;
  - keeps the `perSkill` (4) cards nearest `target = skill rating − targetOffset` (250), judging
    a card by its rating on that tag, else its global rating;
  - appends them to the window's cards: new, jitter-scored, with `cardElo` set to the global
    rating and `skillFetch: { tag, pressure }`. At most 12 extra cards.

  The fetch is on by default and inert without pressured skills. Downstream these are ordinary
  new cards. The intake regulator meters them, lesson gates still apply, ELO distance scores them
  on the global gap (×0.50 at 250 below), and diversity demotes a second card of the same skill.
  Persisted session runs carry `skillFetch` on these cards, so a read-back can count them.
- **Admin view** (`common-ui/src/admin/components/LearnerTagElo.vue`, via
  `db/src/diagnostics/tagElo.ts`). Shows each skill's rating, need, security and the
  skill-median line, so you can see what selection is leaning on and why.

### Configuration

Each piece reads its config as JSON from its strategy doc's `serializedData`:

| Strategy (`implementingClass`) | Config | Default |
|---|---|---|
| `skillPressure` | `SkillPressureConfig`: `gain`, `security` (`false` = need only, or weights / thresholds), plus `SkillNeedConfig` (`minCount`, `scale`, `minSkills`) and the `TagSelector` | not in the pipeline unless declared |
| `elo` | `EloGeneratorConfig`: `skillFetch: { enabled, maxSkills, perSkill, targetOffset, maxScan }` plus every `SkillPressureConfig` field | fetch on, all-exercise-tag selector |

A course that narrows its skill set for the filter should give the ELO doc the same selector.
Otherwise the fetch picks skills from every exercise tag.

LP's example: `skillPressure` with `include: ['gpc:exercise:']`, `exclude: ['gpc:exercise:WORD-']`
(letter-sounds, not sight words), in `content/phoneticAnalytics/scripts/deploy-content.ts`.

## 4. Shapes not taken

- **A per-tag CouchDB index** (`emit([tag, score])`) **with retrieval centred on a tag's rating.**
  Centring doesn't help, because tag ratings start at global and established skills sit near it.
  It also needs something outside the ELO layer to name the tag, which is the job pressure does.
  And the tag index the generators already load, plus one `getCardEloData` batch, fetches a few
  skills' cards in memory. No new view.
- **Tag-aware ELO distance** (`eloDistance`'s `tagAware` option, `window.skuilder.multiDimElo`).
  Built and parked. It measures match, not need, so a weak skill makes its at-level cards look
  *harder*. It can't reach cards outside the window, and the measured effect was small.

## 5. Open questions

- **Where the ELO distance curve is centred.** At gap 0 a learner fails roughly one time in three
  to five. The cards that give high success are 200–400 below and are scored down. This is why
  fetched cards get only ×0.50 today.
- **What ratings mean under gain scoring** (fw 0.3.5: a correct answer never lowers the learner).
  `scale` and `targetOffset` were set from ratings with a timing drain in them.
- **Cold-start seed** for a learner's new tag rating, which is currently their global rating.
- **Seen-but-not-due remediation cards.** The fetch takes only unseen cards. Bringing back easier
  cards a learner has already seen would need a third regulator class.
- **Constants come from one learner.** `minCount` 8, `scale` 150, `gain` 0.5, `targetOffset` 250
  and the security thresholds are config for that reason.
- **Promoting LP's `RecentWeaknessFilter`.** It is decaying miss pressure from the buffer, and
  if promoted it would share the selector.

## 6. Code map

| Concern | Where |
|---|---|
| ELO types, buffer, update | `common/src/elo.ts` |
| Tag roles | `common/src/tagRoles.ts` |
| Need | `common/src/skillNeed.ts` |
| Security, `TagSelector` | `common/src/tagSecurity.ts` |
| Pressure, filter | `db/src/core/navigators/filters/skillPressure.ts` |
| Window + skill fetch | `db/src/core/navigators/generators/elo.ts` |
| Tag → card ids (shared) | `db/src/core/navigators/generators/cardsByTag.ts` |
| Context (`userCourseElo`) | `db/src/core/navigators/Pipeline.ts` `buildContext`; `generators/types.ts`, `filters/types.ts` |
| Global window, ELO view | `db/src/impl/couch/courseDB.ts` `getCardsCenteredAtELO`; `express/src/design-docs.ts` `_design/elo` |
| Persisted run card `skillFetch` | `db/src/core/types/studySession.ts`; `study/SessionController.ts` |
| Admin view | `db/src/diagnostics/tagElo.ts`; `common-ui/src/admin/components/LearnerTagElo.vue` |
