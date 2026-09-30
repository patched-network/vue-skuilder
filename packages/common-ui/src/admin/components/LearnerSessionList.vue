<template>
  <div>
    <p class="text-caption text-medium-emphasis mb-4">
      One row per sitting. Flags name a specific way the session failed to do its job; open one to read its interleaved
      timeline of responses and pipeline runs. <strong>Δ</strong> is movement across the session: ELO, then any progress
      metrics the course declares.
    </p>

    <v-row dense class="mb-2">
      <v-col v-for="tile in tiles" :key="tile.label" cols="6" sm="4" md="2">
        <v-card variant="tonal" :color="tile.color" class="pa-2 text-center">
          <div class="text-h6">{{ tile.value }}</div>
          <div class="text-caption">{{ tile.label }}</div>
        </v-card>
      </v-col>
    </v-row>

    <div class="d-flex align-center flex-wrap mb-3 ga-3">
      <v-btn-toggle v-model="filter" density="compact" color="primary" variant="outlined">
        <v-btn value="all" size="small">All ({{ sessions.length }})</v-btn>
        <v-btn v-for="f in activeFlags" :key="f.flag" :value="f.flag" size="small" :title="SESSION_FLAGS[f.flag].help">
          <v-icon start size="small" :color="FLAG_UI[f.flag].color">{{ FLAG_UI[f.flag].icon }}</v-icon>
          {{ SESSION_FLAGS[f.flag].label }} ({{ f.count }})
        </v-btn>
      </v-btn-toggle>
    </div>

    <v-alert v-if="sessions.length === 0" type="info" variant="tonal">
      No study sessions recorded. Session records began with a framework release; there is no backfill, so earlier
      activity shows only in card history.
    </v-alert>

    <v-table v-else density="compact" class="sk-admin-table">
      <thead>
        <tr>
          <th>Started</th>
          <th>Status</th>
          <th class="text-right">Cards</th>
          <th class="text-right">Acc.</th>
          <th class="text-right">Runs</th>
          <th>Clock</th>
          <th>Δ</th>
          <th>Flags</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in visible" :key="s.doc.sessionId" class="sk-admin-row" @click="emit('open', s.doc.sessionId)">
          <td class="text-no-wrap">{{ fmtTime(s.doc.startTime) }}</td>
          <td>
            <v-chip size="x-small" variant="flat" :color="statusColor(s.doc.status)">{{ s.doc.status }}</v-chip>
          </td>
          <td class="text-right">{{ s.doc.tally?.cardsPresented ?? '—' }}</td>
          <td class="text-right">
            <span v-if="s.accuracy !== null" :class="accuracyClass(s.accuracy)">
              {{ Math.round(s.accuracy * 100) }}%
            </span>
            <span v-else class="text-disabled">—</span>
          </td>
          <td class="text-right">{{ s.doc.runs?.length ?? 0 }}</td>
          <td class="text-no-wrap text-caption">{{ clockText(s) }}</td>
          <td class="text-no-wrap text-caption">
            <template v-for="(d, i) in deltas(s)" :key="d.label">
              <span v-if="i > 0"> · </span>
              <span :class="deltaClass(d.delta)">{{ fmtDelta(d.delta) }}&nbsp;{{ d.label }}</span>
            </template>
            <span v-if="deltas(s).length === 0" class="text-disabled">—</span>
          </td>
          <td>
            <v-icon
              v-for="f in s.flags"
              :key="f"
              size="small"
              class="mr-1"
              :color="FLAG_UI[f].color"
              :title="`${SESSION_FLAGS[f].label}: ${SESSION_FLAGS[f].help}`"
            >
              {{ FLAG_UI[f].icon }}
            </v-icon>
          </td>
          <td class="text-right"><v-icon size="small" class="text-disabled">mdi-chevron-right</v-icon></td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  fmtDelta,
  fmtDuration,
  SESSION_FLAGS,
  summarizeSessions,
  type DiagnosticsInterpreters,
  type LearnerDataset,
  type SessionFlag,
  type SessionSummary,
} from '@vue-skuilder/db/diagnostics';
import { accuracyClass, deltaClass, FLAG_UI, fmtTime, statusColor } from '../display';

/** A learner's sessions, newest first, as triage. Emits `open` with a session id. */
const props = defineProps<{
  dataset: LearnerDataset;
  interpreters?: DiagnosticsInterpreters;
}>();

const emit = defineEmits<{ open: [sessionId: string] }>();

const sessions = computed(() => summarizeSessions(props.dataset, props.interpreters));
const filter = ref<'all' | SessionFlag | undefined>('all');

/** Only offer filters for flags that occur. */
const activeFlags = computed(() => {
  const counts = new Map<SessionFlag, number>();
  for (const s of sessions.value) for (const f of s.flags) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts.entries()].map(([flag, count]) => ({ flag, count })).sort((a, b) => b.count - a.count);
});

// `!filter.value` covers v-btn-toggle's deselect, which clears the model.
const visible = computed(() =>
  !filter.value || filter.value === 'all'
    ? sessions.value
    : sessions.value.filter((s) => s.flags.includes(filter.value as SessionFlag))
);

const tiles = computed(() => {
  const list = sessions.value;
  const closed = list.filter((s) => s.doc.status === 'closed').length;
  const responses = list.reduce((n, s) => n + (s.doc.tally?.responses ?? 0), 0);
  const correct = list.reduce((n, s) => n + (s.doc.tally?.correct ?? 0), 0);
  const seconds = list.reduce((n, s) => n + (s.durationSeconds ?? 0), 0);
  return [
    { label: 'sessions', value: list.length, color: 'primary' },
    { label: 'completed', value: closed, color: 'success' },
    { label: 'not completed', value: list.length - closed, color: 'error' },
    { label: 'responses', value: responses, color: 'primary' },
    {
      label: 'overall acc.',
      value: responses > 0 ? `${Math.round((correct / responses) * 100)}%` : '—',
      color: 'primary',
    },
    { label: 'time studied', value: fmtDuration(seconds), color: 'grey' },
  ];
});

function deltas(s: SessionSummary): Array<{ label: string; delta: number | null }> {
  const out: Array<{ label: string; delta: number | null }> = [];
  if (s.eloNet !== null) out.push({ label: 'elo', delta: Math.round(s.eloNet) });
  for (const label of props.interpreters?.progressMetrics ?? []) {
    const row = s.state.find((r) => r.label === label);
    if (row) out.push({ label, delta: row.delta });
  }
  return out;
}

/** "1m40s of 2m": how much of the planned dose was spent. */
function clockText(s: SessionSummary): string {
  const planned = fmtDuration(s.doc.plannedSeconds);
  return s.durationSeconds === null ? `— of ${planned}` : `${fmtDuration(s.durationSeconds)} of ${planned}`;
}
</script>

<style scoped>
.sk-admin-table :deep(td),
.sk-admin-table :deep(th) {
  font-size: 0.78rem;
}
.sk-admin-row {
  cursor: pointer;
}
.sk-admin-row:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>
