/**
 * Plain-text renderings of derivations, for pasting into an LLM or a note.
 * Every admin view that shows something should be able to hand it out as
 * text; these are those texts. Also the shared number formatting.
 */
import type { StudySessionRunCardTrail, StudySessionRunSummary } from '../core/types/studySession';
import type { RegulatorReading } from '../core/navigators/regulators';
import {
  shortTag,
  type DiagnosticsInterpreters,
  type ResponseEloDelta,
  type SessionDetail,
  type ServedTagStat,
  type EloLedger,
} from './derive';

/** Signed, at most one decimal; `—` for null. */
export function fmtDelta(d: number | null): string {
  if (d === null) return '—';
  if (d === 0) return '0';
  const v = Number.isInteger(d) ? d : Number(d.toFixed(1));
  return v > 0 ? `+${v}` : String(v);
}

/** 45s, 3m20s, 1.5h. */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m${s % 60}s` : `${m}m`;
  return `${(m / 60).toFixed(1)}h`;
}

export function fmtAnswer(a: unknown, max = 40): string {
  if (a == null) return '';
  if (typeof a === 'string' || typeof a === 'number') return String(a);
  try {
    const s = JSON.stringify(a);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return String(a);
  }
}

function fmtScore(n: number): string {
  return Math.abs(n) >= 0.01 || n === 0 ? n.toFixed(2) : n.toExponential(1);
}

function trailText(label: string, t: StudySessionRunCardTrail): string[] {
  const lines = [
    `  ${label}: ${t.cardId} (${t.origin}, ${t.generator ?? '?'}) final ${fmtScore(t.score)}`,
  ];
  for (const p of t.trail) {
    lines.push(`      ${p.action} ${p.strategyName} → ${fmtScore(p.score)}: ${p.reason}`);
  }
  return lines;
}

/** One regulator reading as a line: its urgency, inputs, and multiplier. */
export function regulatorText(r: RegulatorReading): string {
  const i = r.inputs;
  if (r.name === 'review-mass') {
    return (
      `review mass ${r.urgency.toFixed(1)} over ${i.due ?? r.applied} due` +
      ` (healthy ${i.healthyMass}) → ×${r.multiplier.toFixed(2)}`
    );
  }
  const frozen = i.frozenHours ? `, ${i.frozenHours.toFixed(1)}h frozen` : '';
  return (
    `intake ${r.urgency.toFixed(1)}h since a new card${frozen};` +
    ` ${i.eligibleNew ?? r.applied}/${i.newCandidates ?? '?'} new eligible → ×${r.multiplier.toFixed(2)}`
  );
}

/** One run as a compact text block. */
export function runText(run: StudySessionRunSummary): string {
  const L: string[] = [];
  L.push(
    `RUN ${run.label}${run.mode ? ` [${run.mode}]` : ''} @ ${run.at}` +
      ` — generated ${run.generatedCount} → selected ${run.finalCount}` +
      ` (${run.newSelected} new, ${run.reviewsSelected} review)` +
      (run.generatedCount > 0 && run.finalCount === 0 ? '  ⚠ nothing survived' : '')
  );
  if (typeof run.userElo === 'number') L.push(`  userElo: ${Math.round(run.userElo)}`);
  if (run.generators?.length) {
    L.push('  generators:');
    for (const g of run.generators) {
      L.push(
        `    - ${g.name}: ${g.cardCount} cards (${g.newCount} new, ${g.reviewCount} review),` +
          ` topScore ${g.topScore.toFixed(2)}`
      );
    }
  }
  if (run.filters?.length) {
    L.push('  filters:');
    for (const f of run.filters) {
      L.push(
        `    - ${f.name}${f.kind ? ` (${f.kind})` : ''}: +${f.boosted} boosted,` +
          ` -${f.penalized} penalized, ${f.passed} passed, ${f.removed} removed`
      );
    }
  }
  if (run.regulators?.length) {
    L.push('  regulators:');
    for (const r of run.regulators) L.push(`    - ${regulatorText(r)}`);
  }
  if (run.hints) L.push(`  hints: ${JSON.stringify(run.hints)}`);
  if (run.cards?.length) {
    L.push('  selection (✓ selected, · runner-up):');
    for (const c of run.cards) {
      L.push(
        `    ${c.selected ? '✓' : '·'} ${c.cardId} (${c.origin}, ${c.generator ?? '?'}) ${fmtScore(c.score)}`
      );
    }
  }
  if (run.unselectedNew?.nextInLine)
    L.push(...trailText('next new in line', run.unselectedNew.nextInLine));
  if (run.unselectedNew?.topGenerated) {
    L.push(...trailText('top-generated new (sunk)', run.unselectedNew.topGenerated));
  }
  if (run.discardedTail) {
    const t = run.discardedTail;
    L.push(
      `  discardedTail: ${t.count} cards` +
        (t.scoreRange
          ? ` · score [${t.scoreRange[0].toFixed(2)}, ${t.scoreRange[1].toFixed(2)}]`
          : '') +
        (t.eloRange ? ` · elo [${Math.round(t.eloRange[0])}, ${Math.round(t.eloRange[1])}]` : '')
    );
    if (t.note) L.push(`    ${t.note}`);
  }
  return L.join('\n');
}

/** Per-tag ELO deltas worth showing inline: scored, non-zero, at most four. */
export function scoredTagDeltas(elo: ResponseEloDelta): ResponseEloDelta['tags'] {
  return elo.tags.filter((t) => t.score !== null && t.delta !== 0).slice(0, 4);
}

function eloSuffix(elo: ResponseEloDelta | undefined, interp?: DiagnosticsInterpreters): string {
  if (!elo) return '';
  const g = `ELO g:${elo.global.before}→${elo.global.after} (${fmtDelta(elo.global.delta)})`;
  const tags = scoredTagDeltas(elo).map((t) => `${shortTag(interp, t.tag)}:${fmtDelta(t.delta)}`);
  return `  ${g}${tags.length ? ` | ${tags.join(' ')}` : ''}`;
}

function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(11, 19);
}

/**
 * A whole session as plain text, led by a legend so the numbers read without
 * the UI.
 */
export function sessionText(
  username: string,
  detail: SessionDetail,
  extras: { servedTags?: ServedTagStat[]; eloLedger?: EloLedger | null } = {},
  interp?: DiagnosticsInterpreters
): string {
  const s = detail.summary;
  const doc = s.doc;
  const responses = detail.timeline.filter((e) => e.kind === 'response').length;
  const L: string[] = [];

  L.push(`# Study session ${doc.sessionId} — user ${username}`);
  L.push('');
  L.push('## Legend');
  L.push('- The TIMELINE is one time-ordered stream: RUN lines are pipeline (re)plans;');
  L.push('  the lines between them are card responses in the order presented.');
  L.push('- RUN "generated N → selected M (a new, b review)": the pipeline produced N');
  L.push('  candidates and chose M. "nothing survived" = generated > 0 but 0 selected.');
  L.push('  Bootstrap runs fire before card #1; replans are interleaved by time.');
  L.push("- generators: each source's contribution. filters: how each reshaped scores");
  L.push('  (gate: not ready yet; signal: preference). regulators: the pressure on each class,');
  L.push('  review mass (due reviews by value) and intake (hours since a new card).');
  L.push('  hints: the ReplanHints the navigator was told (_label = replan reason).');
  L.push('  selection: the chosen cards and top runners-up. "next new in line" / "top-generated');
  L.push('  new (sunk)": the unselected new cards worth explaining, with each score change.');
  L.push('  Prescribed and hint-required cards count as origin "unknown" (known miscount).');
  L.push('- RESP "✓/✗ type <cardId> [tags] Ts (attempt k) \'answer\'": one presentation and');
  L.push('  its outcome. A trailing "ELO g:before→after (Δ) | tag:Δ …" is the exchange it');
  L.push('  produced. Only first attempts move ELO.');
  L.push('');

  L.push('## Headline');
  L.push(`- status: ${doc.status}`);
  L.push(`- start: ${doc.startTime}${doc.endTime ? ` · end: ${doc.endTime}` : ''}`);
  L.push(
    `- clock: ${s.durationSeconds ?? '—'}s of ${doc.plannedSeconds}s planned` +
      (doc.tally ? ` · ${doc.tally.secondsRemaining}s remaining` : '')
  );
  if (doc.tally) {
    L.push(
      `- tally: ${doc.tally.cardsPresented} cards, ${doc.tally.responses} responses` +
        ` (${doc.tally.correct} correct / ${doc.tally.incorrect} incorrect)` +
        ` · failedQ remaining ${doc.tally.failedQRemaining}`
    );
  }
  L.push(`- flags: ${s.flags.length ? s.flags.join(', ') : 'none'}`);
  L.push(
    `- config: batchLimit ${doc.config?.defaultBatchLimit ?? '?'}, ${doc.config?.sourceCount ?? '?'} source(s)` +
      `, opening queues supply ${doc.initialQueues?.supplyQ ?? '?'} / failed ${doc.initialQueues?.failedQ ?? '?'}`
  );
  if (detail.responsesMissing) {
    L.push(
      `- ⚠ responsesMissing: tally claims ${doc.tally?.responses} responses but only` +
        ` ${responses} stamped records were found.`
    );
  }
  L.push('');

  if (s.state.length) {
    L.push('## Learner state (start → end, Δ)');
    for (const r of s.state)
      L.push(`- ${r.label}: ${r.from ?? '—'} → ${r.to ?? '—'} (${fmtDelta(r.delta)})`);
    L.push('');
  }

  L.push('## Session hints');
  L.push(`- at open: ${doc.config?.initHints ? JSON.stringify(doc.config.initHints) : 'none'}`);
  L.push(`- at close: ${doc.finalHints ? JSON.stringify(doc.finalHints) : 'none'}`);
  L.push('');

  if (extras.servedTags?.length) {
    L.push('## Served tags');
    for (const t of extras.servedTags) {
      L.push(
        `- ${t.tag}: ${t.responses} resp / ${t.cards} card(s)` +
          `, acc ${t.accuracy === null ? 'n/a' : `${Math.round(t.accuracy * 100)}%`}` +
          ` (${t.correct}✓/${t.incorrect}✗), ${(t.totalTimeMs / 1000).toFixed(1)}s`
      );
    }
    L.push('');
  }

  const led = extras.eloLedger;
  if (led) {
    L.push('## ELO ledger (learner global)');
    L.push(
      `- net ${fmtDelta(led.net)} across ${led.count} exchange(s)` +
        ` · gained ${fmtDelta(led.gained)} over ${led.wins} win(s)` +
        ` · lost ${fmtDelta(led.lost)} over ${led.losses} loss(es)`
    );
    L.push('');
  }

  L.push(`## Timeline (${detail.timeline.length} entries)`);
  for (const e of detail.timeline) {
    if (e.kind === 'run') {
      L.push(runText(e.run));
      continue;
    }
    const mark = e.isCorrect === true ? '✓' : e.isCorrect === false ? '✗' : '·';
    const tags = e.tags.length ? ` [${e.tags.join(', ')}]` : '';
    const attempt = e.priorAttempts ? ` (attempt ${e.priorAttempts + 1})` : '';
    const ans = e.userAnswer != null ? ` '${fmtAnswer(e.userAnswer)}'` : '';
    L.push(
      `RESP ${clock(e.at)} ${mark} ${e.questionType ?? 'card'} ${e.cardId}${tags}` +
        ` — ${(e.timeSpentMs / 1000).toFixed(1)}s${attempt}${ans}${eloSuffix(e.elo, interp)}`
    );
  }
  return L.join('\n');
}
