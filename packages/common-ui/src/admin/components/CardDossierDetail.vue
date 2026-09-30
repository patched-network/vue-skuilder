<template>
  <div>
    <div v-if="dossier.card && Object.keys(dossier.card.data).length" class="text-caption mb-2">
      <span v-for="(v, k) in dossier.card.data" :key="k" class="mr-3">
        <span class="text-medium-emphasis">{{ k }}:</span> {{ fmtAnswer(v, 60) }}
      </span>
    </div>
    <div class="d-flex flex-wrap mb-2 ga-1">
      <v-chip
        v-for="t in dossier.card?.tags ?? []"
        :key="t"
        size="x-small"
        variant="outlined"
        :color="isSkillTag(interpreters, t) ? 'primary' : undefined"
      >
        {{ t }}
      </v-chip>
      <span v-if="!dossier.card" class="text-caption text-disabled">no course data in this dataset</span>
    </div>
    <div class="text-caption text-medium-emphasis mb-2">
      lapses {{ dossier.lapses }} · streak {{ dossier.streak }} · best interval
      {{ fmtInterval(dossier.bestIntervalSeconds) }} ·
      <template v-if="dossier.pendingReview">
        next review {{ fmtTime(dossier.pendingReview.reviewTime) }}
        <span v-if="dossier.pendingReview.overdue" class="text-error">(overdue)</span>
      </template>
      <template v-else>no review scheduled</template>
    </div>

    <v-table density="compact" class="sk-record-table">
      <thead>
        <tr>
          <th>#</th>
          <th>When</th>
          <th>Result</th>
          <th>Perf</th>
          <th>Prior att.</th>
          <th>Time</th>
          <th>Answer</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in dossier.records" :key="i" :class="r.isCorrect === false ? 'sk-fail-row' : ''">
          <td>{{ i + 1 }}</td>
          <td class="text-no-wrap">{{ fmtTime(r.timeStamp) }}</td>
          <td>
            <v-icon v-if="r.isCorrect === true" size="small" color="success">mdi-check</v-icon>
            <v-icon v-else-if="r.isCorrect === false" size="small" color="error">mdi-close</v-icon>
            <span v-else class="text-disabled">—</span>
          </td>
          <td>{{ perf(r) }}</td>
          <td>{{ r.priorAttemps ?? '—' }}</td>
          <td>{{ ((r.timeSpent ?? 0) / 1000).toFixed(1) }}s</td>
          <td class="text-truncate" style="max-width: 200px">{{ fmtAnswer(r.userAnswer) }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import {
  fmtAnswer,
  isSkillTag,
  recordPerformance,
  type CardDossier,
  type DatasetRecord,
  type DiagnosticsInterpreters,
} from '@vue-skuilder/db/diagnostics';
import { fmtTime } from '../display';

/** One card's record for one learner: content, tags, scheduling state, and every response. */
defineProps<{
  dossier: CardDossier;
  interpreters?: DiagnosticsInterpreters;
}>();

function perf(r: DatasetRecord): string {
  const p = recordPerformance(r);
  return p === null ? '—' : p.toFixed(2);
}

function fmtInterval(s: number): string {
  if (!s) return 'none';
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
</script>

<style scoped>
.sk-record-table :deep(td),
.sk-record-table :deep(th) {
  font-size: 0.78rem;
}
.sk-fail-row {
  background-color: rgba(var(--v-theme-error), 0.06);
}
</style>
