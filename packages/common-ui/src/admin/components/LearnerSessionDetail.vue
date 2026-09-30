<template>
  <div>
    <v-alert v-if="!detail" type="info" variant="tonal">No session with id {{ sessionId }}.</v-alert>

    <template v-else>
      <div class="d-flex align-center flex-wrap mb-4 ga-2">
        <v-chip size="small" variant="flat" :color="statusColor(doc.status)">{{ doc.status }}</v-chip>
        <v-chip size="small" variant="tonal">{{ fmtTime(doc.startTime) }}</v-chip>
        <v-chip size="small" variant="tonal" color="grey">{{ clockText }}</v-chip>
        <v-chip
          v-for="f in detail.summary.flags"
          :key="f"
          size="small"
          variant="tonal"
          :color="FLAG_UI[f].color"
          :title="SESSION_FLAGS[f].help"
        >
          <v-icon start size="small">{{ FLAG_UI[f].icon }}</v-icon>
          {{ SESSION_FLAGS[f].label }}
        </v-chip>
        <v-spacer />
        <code class="text-caption text-medium-emphasis">{{ sessionId }}</code>
        <v-btn
          variant="text"
          size="small"
          :prepend-icon="copied === 'session' ? 'mdi-check' : 'mdi-clipboard-text-outline'"
          :color="copied === 'session' ? 'success' : undefined"
          @click="copy(asText(), 'session')"
        >
          {{ copied === 'session' ? 'Copied' : 'Copy as text' }}
        </v-btn>
      </div>

      <v-alert v-if="detail.responsesMissing" type="warning" variant="tonal" density="compact" class="mb-4">
        The session records {{ doc.tally?.responses }} responses but only {{ responseCount }} card records carry its id.
        The timeline is incomplete.
      </v-alert>

      <v-row class="mb-2">
        <v-col cols="12" md="6">
          <v-card variant="outlined" class="pa-3 h-100">
            <div class="text-subtitle-2 mb-1">Learner state</div>
            <div class="text-caption text-medium-emphasis mb-3">
              What the navigator was choosing against, and what moved.
            </div>
            <v-table v-if="detail.summary.state.length" density="compact" class="sk-mini-table">
              <thead>
                <tr>
                  <th></th>
                  <th class="text-right">Start</th>
                  <th class="text-right">End</th>
                  <th class="text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in detail.summary.state" :key="row.label">
                  <td>{{ row.label }}</td>
                  <td class="text-right">{{ fmtNum(row.from) }}</td>
                  <td class="text-right">{{ fmtNum(row.to) }}</td>
                  <td class="text-right" :class="deltaClass(row.delta)">{{ fmtDelta(row.delta) }}</td>
                </tr>
              </tbody>
            </v-table>
            <div v-else class="text-caption text-disabled">No state snapshot recorded.</div>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card variant="outlined" class="pa-3 h-100">
            <div class="text-subtitle-2 mb-1">Session hints</div>
            <div class="text-caption text-medium-emphasis mb-3">
              What outcome observers told the navigator. They act only through these.
            </div>
            <span class="text-caption font-weight-medium">at open</span>
            <pre class="sk-hint-block">{{ fmtHints(doc.config?.initHints) }}</pre>
            <span class="text-caption font-weight-medium">at close</span>
            <pre class="sk-hint-block">{{ fmtHints(doc.finalHints) }}</pre>
          </v-card>
        </v-col>
      </v-row>

      <div class="text-caption text-medium-emphasis mb-4">
        batch limit {{ doc.config?.defaultBatchLimit ?? '?' }} · {{ doc.config?.sourceCount ?? '?' }} source(s) ·
        opening queues supply {{ doc.initialQueues?.supplyQ ?? '?' }} / failed {{ doc.initialQueues?.failedQ ?? '?' }}
        <template v-if="doc.tally"> · ended with {{ doc.tally.failedQRemaining }} still in the failed queue</template>
      </div>

      <v-card v-if="tags.length" variant="outlined" class="pa-3 mb-4">
        <div class="text-subtitle-2 mb-1">Served tags</div>
        <div class="text-caption text-medium-emphasis mb-2">
          What this sitting put in front of the learner, by content tag. A response with several tags counts toward
          each.
        </div>
        <v-table density="compact" class="sk-mini-table">
          <thead>
            <tr>
              <th>Tag</th>
              <th class="text-right">Resp.</th>
              <th class="text-right">Cards</th>
              <th class="text-right">Accuracy</th>
              <th class="text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tags" :key="t.tag">
              <td>
                <code :class="isSkillTag(interpreters, t.tag) ? 'text-primary' : ''">{{ t.tag }}</code>
              </td>
              <td class="text-right">{{ t.responses }}</td>
              <td class="text-right">{{ t.cards }}</td>
              <td class="text-right" :class="accuracyClass(t.accuracy)">
                <template v-if="t.accuracy === null">—</template>
                <template v-else>
                  {{ Math.round(t.accuracy * 100) }}%
                  <span class="text-disabled">({{ t.correct }}/{{ t.correct + t.incorrect }})</span>
                </template>
              </td>
              <td class="text-right">{{ (t.totalTimeMs / 1000).toFixed(1) }}s</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <v-card v-if="ledger" variant="outlined" class="pa-3 mb-4">
        <div class="text-subtitle-2 mb-1">ELO ledger</div>
        <div class="text-caption text-medium-emphasis mb-3">
          The per-response learner global-ELO exchanges that net to the session's ELO move. Wins above the learner's
          level pay little; losses below it cost a lot, so a high hit rate can still net negative.
        </div>
        <div class="d-flex flex-wrap ga-5">
          <div>
            <div class="text-caption text-medium-emphasis">net</div>
            <div class="text-h6" :class="deltaClass(ledger.net)">{{ fmtDelta(ledger.net) }}</div>
          </div>
          <div>
            <div class="text-caption text-medium-emphasis">gained · {{ ledger.wins }} win(s)</div>
            <div class="text-h6 text-success">{{ fmtDelta(ledger.gained) }}</div>
          </div>
          <div>
            <div class="text-caption text-medium-emphasis">lost · {{ ledger.losses }} loss(es)</div>
            <div class="text-h6 text-error">{{ fmtDelta(ledger.lost) }}</div>
          </div>
          <div>
            <div class="text-caption text-medium-emphasis">exchanges</div>
            <div class="text-h6">{{ ledger.count }}</div>
            <div class="text-caption text-disabled">of {{ responseCount }} response(s)</div>
          </div>
        </div>
      </v-card>

      <div class="d-flex align-center flex-wrap mb-2 ga-3">
        <h2 class="text-h6">Timeline</h2>
        <v-btn-toggle v-model="show" density="compact" color="primary" variant="outlined">
          <v-btn value="all" size="small">All ({{ detail.timeline.length }})</v-btn>
          <v-btn value="response" size="small">Responses ({{ responseCount }})</v-btn>
          <v-btn value="run" size="small">Runs ({{ detail.timeline.length - responseCount }})</v-btn>
        </v-btn-toggle>
      </div>

      <v-alert v-if="detail.timeline.length === 0" type="info" variant="tonal"
        >Nothing recorded for this session.</v-alert
      >

      <div v-else class="sk-timeline">
        <div v-for="(e, i) in visibleTimeline" :key="i" class="sk-tl-row" :class="rowClass(e)">
          <div class="sk-tl-time text-caption text-disabled">{{ fmtClock(e.at) }}</div>
          <div class="sk-tl-gutter">
            <v-icon size="small" :color="entryColor(e)">{{ entryIcon(e) }}</v-icon>
          </div>

          <div v-if="e.kind === 'run'" class="sk-tl-body">
            <div class="d-flex align-center flex-wrap ga-1">
              <span class="font-weight-medium">{{ e.run.label }}</span>
              <v-chip v-if="e.run.mode" size="x-small" variant="tonal">{{ e.run.mode }}</v-chip>
              <span class="text-caption text-medium-emphasis ml-2">
                generated {{ e.run.generatedCount }} → selected {{ e.run.finalCount }} ({{ e.run.newSelected }} new,
                {{ e.run.reviewsSelected }} review)
              </span>
              <span v-if="e.run.generatedCount > 0 && e.run.finalCount === 0" class="text-caption text-error ml-2">
                nothing survived
              </span>
              <v-chip v-if="typeof e.run.userElo === 'number'" size="x-small" variant="tonal" color="grey" class="ml-2">
                ELO {{ Math.round(e.run.userElo) }}
              </v-chip>
              <v-spacer />
              <v-btn
                :icon="expanded.has(e.run.runId) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                size="x-small"
                variant="text"
                @click="toggle(e.run.runId)"
              />
              <v-btn
                :icon="copied === e.run.runId ? 'mdi-check' : 'mdi-content-copy'"
                size="x-small"
                variant="text"
                :color="copied === e.run.runId ? 'success' : undefined"
                title="Copy run as text"
                @click="copy(runText(e.run), e.run.runId)"
              />
            </div>
            <run-detail
              v-if="expanded.has(e.run.runId)"
              :run="e.run"
              class="mt-1"
              @open-card="(id: string) => emit('open-card', id)"
            />
          </div>

          <div v-else class="sk-tl-body">
            <a class="sk-card-link" :title="`Open ${e.cardId} in card history`" @click="emit('open-card', e.cardId)">
              {{ e.questionType ?? 'card' }} <code class="text-caption">{{ shortId(e.cardId) }}</code>
            </a>
            <v-chip
              v-for="t in skillTags(e.tags)"
              :key="t"
              size="x-small"
              variant="outlined"
              color="primary"
              class="ml-1"
            >
              {{ shortTag(interpreters, t) }}
            </v-chip>
            <span class="text-caption text-medium-emphasis ml-2">
              {{ (e.timeSpentMs / 1000).toFixed(1) }}s
              <template v-if="e.priorAttempts"> · attempt {{ e.priorAttempts + 1 }}</template>
            </span>
            <span v-if="e.userAnswer != null" class="text-caption text-disabled ml-2"
              >“{{ fmtAnswer(e.userAnswer) }}”</span
            >
            <template v-if="e.elo">
              <v-chip
                size="x-small"
                variant="tonal"
                :color="deltaColor(e.elo.global.delta)"
                class="ml-2"
                :title="`learner global ELO ${e.elo.global.before} → ${e.elo.global.after} · userScore ${e.elo.userScore.toFixed(2)}`"
              >
                ELO {{ fmtDelta(e.elo.global.delta) }}
              </v-chip>
              <v-chip
                v-for="t in scoredTagDeltas(e.elo)"
                :key="t.tag"
                size="x-small"
                variant="text"
                :color="deltaColor(t.delta)"
                class="sk-elo-tag"
                :title="`${t.tag}: ${t.before} → ${t.after} (score ${t.score?.toFixed(2)})`"
              >
                {{ shortTag(interpreters, t.tag) }} {{ fmtDelta(t.delta) }}
              </v-chip>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  eloLedger,
  fmtAnswer,
  fmtDelta,
  fmtDuration,
  isSkillTag,
  runText,
  scoredTagDeltas,
  servedTags,
  SESSION_FLAGS,
  sessionDetail,
  sessionText,
  shortTag,
  type DiagnosticsInterpreters,
  type LearnerDataset,
  type TimelineEntry,
} from '@vue-skuilder/db/diagnostics';
import {
  accuracyClass,
  deltaClass,
  deltaColor,
  FLAG_UI,
  fmtClock,
  fmtTime,
  shortId,
  statusColor,
  useCopy,
} from '../display';
import RunDetail from './RunDetail.vue';

/** One session: headline, state, hints, served tags, ELO ledger, and the interleaved timeline. */
const props = defineProps<{
  dataset: LearnerDataset;
  sessionId: string;
  interpreters?: DiagnosticsInterpreters;
}>();

const emit = defineEmits<{ 'open-card': [cardId: string] }>();

const detail = computed(() => sessionDetail(props.dataset, props.sessionId, props.interpreters));
const doc = computed(() => detail.value!.summary.doc);
const tags = computed(() => servedTags(detail.value?.timeline ?? [], props.interpreters));
const ledger = computed(() => eloLedger(detail.value?.timeline ?? []));
const responseCount = computed(() => detail.value?.timeline.filter((e) => e.kind === 'response').length ?? 0);

const show = ref<'all' | 'response' | 'run' | undefined>('all');
const visibleTimeline = computed(() => {
  const t = detail.value?.timeline ?? [];
  return !show.value || show.value === 'all' ? t : t.filter((e) => e.kind === show.value);
});

const expanded = ref(new Set<string>());
function toggle(runId: string): void {
  const next = new Set(expanded.value);
  if (next.has(runId)) next.delete(runId);
  else next.add(runId);
  expanded.value = next;
}

const { copied, copy } = useCopy();

function asText(): string {
  return detail.value
    ? sessionText(
        props.dataset.username,
        detail.value,
        { servedTags: tags.value, eloLedger: ledger.value },
        props.interpreters
      )
    : '';
}

const clockText = computed(() => {
  const s = detail.value?.summary;
  if (!s) return '';
  const planned = fmtDuration(s.doc.plannedSeconds);
  return s.durationSeconds === null ? `— of ${planned}` : `${fmtDuration(s.durationSeconds)} of ${planned}`;
});

/** Skill tags inline, at most three. Without a course interpreter, none are singled out. */
function skillTags(t: string[]): string[] {
  return t.filter((tag) => isSkillTag(props.interpreters, tag)).slice(0, 3);
}

function fmtNum(n: number | null): string {
  if (n === null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtHints(h: unknown): string {
  return h == null ? 'none' : JSON.stringify(h, null, 2);
}

// Narrow the timeline union in script: vue-tsc handles discriminated unions
// inside template bindings least reliably.
function entryIcon(e: TimelineEntry): string {
  if (e.kind === 'run') return 'mdi-cog-refresh-outline';
  if (e.isCorrect === true) return 'mdi-check-circle-outline';
  if (e.isCorrect === false) return 'mdi-close-circle-outline';
  return 'mdi-circle-small';
}

function entryColor(e: TimelineEntry): string {
  if (e.kind === 'run') return 'primary';
  if (e.isCorrect === true) return 'success';
  if (e.isCorrect === false) return 'error';
  return 'grey';
}

function rowClass(e: TimelineEntry): string {
  if (e.kind === 'run') return 'sk-tl-run';
  return e.isCorrect === false ? 'sk-tl-fail' : '';
}
</script>

<style scoped>
.sk-mini-table :deep(td),
.sk-mini-table :deep(th) {
  font-size: 0.78rem;
}
.sk-hint-block {
  font-size: 0.72rem;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 4px;
  padding: 6px 8px;
  margin: 0 0 8px;
  max-height: 140px;
  overflow: auto;
  white-space: pre-wrap;
}
.sk-timeline {
  border-left: 2px solid rgba(var(--v-theme-on-surface), 0.12);
  margin-left: 62px;
}
.sk-tl-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 8px 3px 0;
  position: relative;
}
.sk-tl-time {
  position: absolute;
  left: -62px;
  width: 56px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.sk-tl-gutter {
  margin-left: -11px;
  background: rgb(var(--v-theme-surface));
  line-height: 1;
}
.sk-tl-body {
  flex: 1;
  min-width: 0;
  font-size: 0.82rem;
}
/* Runs are the navigator speaking: tint them so responses read as the
   foreground stream and replans as punctuation between them. */
.sk-tl-run {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
.sk-tl-fail {
  background-color: rgba(var(--v-theme-error), 0.06);
}
.sk-card-link {
  cursor: pointer;
  color: inherit;
  border-bottom: 1px dotted rgba(var(--v-theme-on-surface), 0.3);
}
.sk-card-link:hover {
  color: rgb(var(--v-theme-primary));
}
.sk-elo-tag {
  font-size: 0.68rem !important;
  padding-inline: 4px !important;
}
</style>
