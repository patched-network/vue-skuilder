import type { DatasetRecord, LearnerDataset } from './dataset';
import type { FilterKind } from '../core/navigators/filters/types';
import type { RegulatorName, RegulatorReading } from '../core/navigators/regulators';
import type { StudySessionRunCard, StudySessionRunSummary } from '../core/types/studySession';

/**
 * What put a run's card in the queue: the hint that required it, else the
 * generator that produced it. Its `origin` says what it is (review or new).
 */
export function runCardSource(card: Pick<StudySessionRunCard, 'generator' | 'required'>): string {
  if (card.required) return `required: ${card.required}`;
  return card.generator ?? 'unknown';
}

/**
 * A run's selected cards counted by source, most first. Empty for runs that
 * don't persist their cards (before 0.2.28).
 */
export function selectedBySource(
  run: Pick<StudySessionRunSummary, 'cards'>
): Array<{ source: string; count: number }> {
  const counts = new Map<string, number>();
  for (const c of run.cards ?? []) {
    if (!c.selected) continue;
    const source = runCardSource(c);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return [...counts]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================================
// Pipeline run stats
// ============================================================================
//
// What each pipeline piece did across a learner's persisted runs, keyed by the
// names runs report generators and filters under. Those are the strategy docs'
// names, so these join to a `PipelinePlan` (`@vue-skuilder/db`) by name.
//
// Selection and outcome counts need runs that persist their selected cards
// (`StudySessionRunSummary.cards`, 0.2.28+). Older runs contribute only their
// generator and filter summaries.
//
// Generator new/review counts: before 0.2.29 the ELO generator's cards were
// counted as neither (the counts went by reason text), so means over older
// runs undercount `new`.
//
// ============================================================================

/** One generator across persisted runs. */
export interface GeneratorRunStat {
  /** The name runs report it under (its strategy doc's name). */
  name: string;
  /** Runs it emitted at least one candidate in. */
  runs: number;
  /** Mean candidates per run, over the runs it appeared in. */
  meanCards: number;
  meanNew: number;
  meanReview: number;
  topScoreMax: number;
  /** Top score in the most recent run it appeared in. */
  topScoreLast: number;
  /** Selected cards it originated (first provenance entry), over runs that persist selection. */
  selected: number;
  /** First attempts at those cards in the same session. */
  firstAttempts: number;
  firstAttemptsCorrect: number;
}

/** One filter across persisted runs: candidate counts summed over runs. */
export interface FilterRunStat {
  name: string;
  /** As recorded by the most recent run that recorded it (0.2.29+). */
  kind?: FilterKind;
  runs: number;
  boosted: number;
  penalized: number;
  passed: number;
  removed: number;
}

/** One regulator across persisted runs (0.2.29+). */
export interface RegulatorRunStat {
  name: RegulatorName;
  class: RegulatorReading['class'];
  runs: number;
  meanMultiplier: number;
  maxMultiplier: number;
  /** Runs where the multiplier was above 1. */
  runsActive: number;
  /** The most recent reading. */
  last: RegulatorReading;
}

export interface PipelineRunStats {
  sessions: number;
  runs: number;
  /** Runs that persist their selected cards. Selection and outcome counts cover only these. */
  runsWithSelection: number;
  firstRunAt?: string;
  lastRunAt?: string;
  /** Busiest first. */
  generators: GeneratorRunStat[];
  /** By name. */
  filters: FilterRunStat[];
  /** Empty before 0.2.29. */
  regulators: RegulatorRunStat[];
  /** Selected cards with no originating generator: cards forced in by `requireCards`. */
  selectedUnattributed: number;
}

/** Aggregate a learner's persisted pipeline runs, optionally only sessions started at or after `since` (ISO). */
export function pipelineRunStats(
  ds: LearnerDataset,
  opts: { since?: string } = {}
): PipelineRunStats {
  const sessions = ds.sessions.filter((s) => !opts.since || s.startTime >= opts.since);

  const recordsBySession = new Map<string, Array<{ cardId: string; record: DatasetRecord }>>();
  for (const h of ds.cardHistories) {
    for (const record of h.records) {
      if (!record.sessionId) continue;
      const list = recordsBySession.get(record.sessionId) ?? [];
      list.push({ cardId: h.cardID, record });
      recordsBySession.set(record.sessionId, list);
    }
  }

  type GenAcc = Omit<GeneratorRunStat, 'meanCards' | 'meanNew' | 'meanReview'> & {
    cards: number;
    newCards: number;
    reviewCards: number;
  };
  const gens = new Map<string, GenAcc>();
  const gen = (name: string): GenAcc => {
    let g = gens.get(name);
    if (!g) {
      g = {
        name,
        runs: 0,
        cards: 0,
        newCards: 0,
        reviewCards: 0,
        topScoreMax: 0,
        topScoreLast: 0,
        selected: 0,
        firstAttempts: 0,
        firstAttemptsCorrect: 0,
      };
      gens.set(name, g);
    }
    return g;
  };
  const filters = new Map<string, FilterRunStat>();
  const regulators = new Map<RegulatorName, RegulatorRunStat & { sumMultiplier: number }>();

  let runs = 0;
  let runsWithSelection = 0;
  let selectedUnattributed = 0;
  let firstRunAt: string | undefined;
  let lastRunAt: string | undefined;

  for (const session of sessions) {
    // A card selected by several runs is credited to the first run that chose it.
    const originBySelectedCard = new Map<string, string>();

    for (const run of session.runs ?? []) {
      runs++;
      if (!firstRunAt || run.at < firstRunAt) firstRunAt = run.at;
      if (!lastRunAt || run.at > lastRunAt) lastRunAt = run.at;

      for (const s of run.generators ?? []) {
        const g = gen(s.name);
        g.runs++;
        g.cards += s.cardCount;
        g.newCards += s.newCount;
        g.reviewCards += s.reviewCount;
        g.topScoreMax = Math.max(g.topScoreMax, s.topScore);
        g.topScoreLast = s.topScore;
      }

      for (const f of run.filters ?? []) {
        const acc = filters.get(f.name) ?? {
          name: f.name,
          runs: 0,
          boosted: 0,
          penalized: 0,
          passed: 0,
          removed: 0,
        };
        acc.runs++;
        if (f.kind) acc.kind = f.kind;
        acc.boosted += f.boosted;
        acc.penalized += f.penalized;
        acc.passed += f.passed;
        acc.removed += f.removed;
        filters.set(f.name, acc);
      }

      for (const r of run.regulators ?? []) {
        const acc = regulators.get(r.name) ?? {
          name: r.name,
          class: r.class,
          runs: 0,
          meanMultiplier: 0,
          maxMultiplier: 0,
          runsActive: 0,
          last: r,
          sumMultiplier: 0,
        };
        acc.runs++;
        acc.sumMultiplier += r.multiplier;
        acc.maxMultiplier = Math.max(acc.maxMultiplier, r.multiplier);
        if (r.multiplier > 1) acc.runsActive++;
        acc.last = r;
        regulators.set(r.name, acc);
      }

      if (run.cards) {
        runsWithSelection++;
        for (const c of run.cards) {
          if (!c.selected) continue;
          if (!c.generator) {
            selectedUnattributed++;
            continue;
          }
          gen(c.generator).selected++;
          if (!originBySelectedCard.has(c.cardId)) originBySelectedCard.set(c.cardId, c.generator);
        }
      }
    }

    for (const { cardId, record } of recordsBySession.get(session.sessionId) ?? []) {
      const origin = originBySelectedCard.get(cardId);
      if (!origin || record.priorAttemps !== 0) continue;
      const g = gen(origin);
      g.firstAttempts++;
      if (record.isCorrect === true) g.firstAttemptsCorrect++;
    }
  }

  return {
    sessions: sessions.length,
    runs,
    runsWithSelection,
    firstRunAt,
    lastRunAt,
    generators: [...gens.values()]
      .map(({ cards, newCards, reviewCards, ...g }) => ({
        ...g,
        meanCards: g.runs ? cards / g.runs : 0,
        meanNew: g.runs ? newCards / g.runs : 0,
        meanReview: g.runs ? reviewCards / g.runs : 0,
      }))
      .sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name)),
    filters: [...filters.values()].sort((a, b) => a.name.localeCompare(b.name)),
    regulators: [...regulators.values()].map(({ sumMultiplier, ...r }) => ({
      ...r,
      meanMultiplier: r.runs ? sumMultiplier / r.runs : 0,
    })),
    selectedUnattributed,
  };
}
