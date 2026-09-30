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
          <card-dossier-detail :dossier="c" :interpreters="interpreters" />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
  cardDossiers,
  fmtDuration,
  type CardDossier,
  type DiagnosticsInterpreters,
  type LearnerDataset,
} from '@vue-skuilder/db/diagnostics';
import { shortId } from '../display';
import CardDossierDetail from './CardDossierDetail.vue';

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
