<template>
  <div>
    <p class="text-caption text-medium-emphasis mb-4">
      Every card the learner has met, most painful first (time sunk × failures), with its pending review and current
      card ELO. <v-icon size="x-small" color="error">mdi-sync-alert</v-icon> is a failed card holding an overdue review;
      <v-icon size="x-small" color="warning">mdi-snowflake</v-icon> is a repeatedly failed card whose ELO has fewer
      updates than failures.
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
        <v-btn value="all" size="small">All ({{ cards.length }})</v-btn>
        <v-btn value="stuck" size="small">
          <v-icon start size="small" color="error">mdi-sync-alert</v-icon>
          Stuck ({{ counts.stuck }})
        </v-btn>
        <v-btn value="failed" size="small">Ever failed ({{ counts.failed }})</v-btn>
        <v-btn value="frozen" size="small">
          <v-icon start size="small" color="warning">mdi-snowflake</v-icon>
          Frozen ELO ({{ counts.frozen }})
        </v-btn>
      </v-btn-toggle>
      <v-text-field
        v-model="search"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        placeholder="filter by card / tag / type / content"
        prepend-inner-icon="mdi-magnify"
        style="max-width: 320px"
      />
    </div>

    <v-alert v-if="cards.length === 0" type="info" variant="tonal">No card history for this learner.</v-alert>

    <v-expansion-panels v-else v-model="open" multiple variant="accordion">
      <v-expansion-panel
        v-for="c in visible"
        :key="c.cardId"
        :value="c.cardId"
        :data-card="c.cardId"
        :class="c.cardId === flash ? 'sk-card-flash' : ''"
      >
        <v-expansion-panel-title>
          <div class="d-flex align-center flex-wrap ga-2" style="width: 100%">
            <v-icon v-if="c.stuck" color="error" size="small" title="failed + overdue review">mdi-sync-alert</v-icon>
            <v-icon v-if="c.frozenElo" color="warning" size="small" title="repeatedly failed, ELO barely updated">
              mdi-snowflake
            </v-icon>
            <span class="text-body-2 font-weight-medium">{{ c.card?.questionType ?? 'card' }}</span>
            <code class="text-caption text-medium-emphasis">{{ shortId(c.cardId, 24) }}</code>
            <span v-if="headline(c)" class="text-caption">{{ headline(c) }}</span>
            <v-spacer />
            <v-chip v-if="c.fails > 0" size="x-small" color="error" variant="tonal">
              {{ c.fails }} fail{{ c.fails === 1 ? '' : 's' }}
            </v-chip>
            <v-chip size="x-small" variant="tonal">{{ c.attempts }} view{{ c.attempts === 1 ? '' : 's' }}</v-chip>
            <v-chip size="x-small" variant="tonal" color="grey">{{ fmtDuration(c.totalTimeMs / 1000) }}</v-chip>
            <v-chip
              v-if="c.pendingReview"
              size="x-small"
              :color="c.pendingReview.overdue ? 'error' : 'success'"
              variant="flat"
            >
              review {{ c.pendingReview.overdue ? 'overdue' : 'scheduled' }}
            </v-chip>
            <v-chip size="x-small" variant="tonal" :color="c.frozenElo ? 'warning' : undefined">
              ELO {{ c.cardElo !== null ? Math.round(c.cardElo) : '?' }}
              <span v-if="c.cardEloCount !== null" class="ml-1 text-disabled">/{{ c.cardEloCount }}</span>
            </v-chip>
          </div>
        </v-expansion-panel-title>

        <v-expansion-panel-text>
          <div v-if="c.card && Object.keys(c.card.data).length" class="text-caption mb-2">
            <span v-for="(v, k) in c.card.data" :key="k" class="mr-3">
              <span class="text-medium-emphasis">{{ k }}:</span> {{ fmtAnswer(v, 60) }}
            </span>
          </div>
          <div class="d-flex flex-wrap mb-2 ga-1">
            <v-chip
              v-for="t in c.card?.tags ?? []"
              :key="t"
              size="x-small"
              variant="outlined"
              :color="isSkillTag(interpreters, t) ? 'primary' : undefined"
            >
              {{ t }}
            </v-chip>
            <span v-if="!c.card" class="text-caption text-disabled">no course data in this dataset</span>
          </div>
          <div class="text-caption text-medium-emphasis mb-2">
            lapses {{ c.lapses }} · streak {{ c.streak }} · best interval {{ fmtInterval(c.bestIntervalSeconds) }} ·
            <template v-if="c.pendingReview">next review {{ fmtTime(c.pendingReview.reviewTime) }}</template>
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
              <tr v-for="(r, i) in c.records" :key="i" :class="r.isCorrect === false ? 'sk-fail-row' : ''">
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
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
  cardDossiers,
  fmtAnswer,
  fmtDuration,
  isSkillTag,
  recordPerformance,
  type CardDossier,
  type DatasetRecord,
  type DiagnosticsInterpreters,
  type LearnerDataset,
} from '@vue-skuilder/db/diagnostics';
import { fmtTime, shortId } from '../display';

/**
 * Every card the learner has history with. `focus` opens, scrolls to, and
 * briefly highlights one card (e.g. followed from a session timeline).
 */
const props = defineProps<{
  dataset: LearnerDataset;
  interpreters?: DiagnosticsInterpreters;
  focus?: string;
}>();

const cards = computed(() => cardDossiers(props.dataset));
const filter = ref<'all' | 'stuck' | 'failed' | 'frozen' | undefined>('all');
const search = ref<string | null>('');
const open = ref<string[]>([]);
const flash = ref<string | null>(null);

const counts = computed(() => ({
  stuck: cards.value.filter((c) => c.stuck).length,
  failed: cards.value.filter((c) => c.fails > 0).length,
  frozen: cards.value.filter((c) => c.frozenElo).length,
}));

const tiles = computed(() => [
  { label: 'cards seen', value: cards.value.length, color: 'primary' },
  { label: 'total attempts', value: cards.value.reduce((n, c) => n + c.attempts, 0), color: 'primary' },
  { label: 'total fails', value: cards.value.reduce((n, c) => n + c.fails, 0), color: 'error' },
  {
    label: 'time on cards',
    value: fmtDuration(cards.value.reduce((n, c) => n + c.totalTimeMs, 0) / 1000),
    color: 'grey',
  },
  { label: 'stuck reviews', value: counts.value.stuck, color: 'error' },
  { label: 'frozen ELO', value: counts.value.frozen, color: 'warning' },
]);

const visible = computed(() => {
  let list = cards.value;
  if (filter.value === 'stuck') list = list.filter((c) => c.stuck);
  else if (filter.value === 'failed') list = list.filter((c) => c.fails > 0);
  else if (filter.value === 'frozen') list = list.filter((c) => c.frozenElo);
  const q = search.value?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (c) =>
        c.cardId.toLowerCase().includes(q) ||
        (c.card?.questionType ?? '').toLowerCase().includes(q) ||
        (c.card?.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
        Object.values(c.card?.data ?? {}).some((v) => typeof v === 'string' && v.toLowerCase().includes(q))
    );
  }
  return list;
});

/** The first short string field of the card's content (usually the word or prompt). */
function headline(c: CardDossier): string {
  const v = Object.values(c.card?.data ?? {}).find((x) => typeof x === 'string' && x.length <= 40);
  return typeof v === 'string' ? v : '';
}

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

async function applyFocus(id: string | undefined): Promise<void> {
  if (!id || !cards.value.some((c) => c.cardId === id)) return;
  filter.value = 'all';
  search.value = id;
  open.value = [id];
  await nextTick();
  document.querySelector(`[data-card="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  flash.value = id;
  setTimeout(() => {
    if (flash.value === id) flash.value = null;
  }, 2200);
}

watch(
  () => props.focus,
  (id) => void applyFocus(id),
  { immediate: true }
);
</script>

<style scoped>
.sk-record-table :deep(td),
.sk-record-table :deep(th) {
  font-size: 0.78rem;
}
.sk-fail-row {
  background-color: rgba(var(--v-theme-error), 0.06);
}
.sk-card-flash {
  animation: sk-card-flash 2.2s ease-out;
}
@keyframes sk-card-flash {
  0%,
  30% {
    background-color: rgba(var(--v-theme-primary), 0.18);
  }
  100% {
    background-color: transparent;
  }
}
</style>
