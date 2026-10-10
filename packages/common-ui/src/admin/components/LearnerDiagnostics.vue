<template>
  <div>
    <v-tabs v-model="tab" density="compact" class="mb-4">
      <v-tab value="sessions">Sessions ({{ dataset.sessions.length }})</v-tab>
      <v-tab value="cards">Cards ({{ dataset.cardHistories.length }})</v-tab>
      <v-tab v-if="dataset.strategies" value="pipeline">Pipeline</v-tab>
      <v-tab value="elo">ELO</v-tab>
    </v-tabs>

    <template v-if="tab === 'sessions'">
      <template v-if="sessionId">
        <v-btn variant="text" size="small" prepend-icon="mdi-arrow-left" class="mb-2" @click="sessionId = null">
          All sessions
        </v-btn>
        <learner-session-detail
          :dataset="dataset"
          :session-id="sessionId"
          :interpreters="interpreters"
          @open-card="openCard"
        />
      </template>
      <learner-session-list
        v-else
        :dataset="dataset"
        :interpreters="interpreters"
        @open="(id: string) => (sessionId = id)"
      />
    </template>

    <learner-card-history
      v-else-if="tab === 'cards'"
      :dataset="dataset"
      :interpreters="interpreters"
      :focus="focusCard"
    />

    <pipeline-overview
      v-else-if="tab === 'pipeline' && dataset.strategies"
      :strategies="dataset.strategies"
      :course-id="dataset.courseId"
      :stats="pipelineStats"
      :stats-label="dataset.username"
    />

    <learner-tag-elo v-else-if="tab === 'elo'" :dataset="dataset" :interpreters="interpreters" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { pipelineRunStats, type DiagnosticsInterpreters, type LearnerDataset } from '@vue-skuilder/db/diagnostics';
import LearnerCardHistory from './LearnerCardHistory.vue';
import LearnerSessionDetail from './LearnerSessionDetail.vue';
import LearnerSessionList from './LearnerSessionList.vue';
import LearnerTagElo from './LearnerTagElo.vue';
import PipelineOverview from './PipelineOverview.vue';

/**
 * One learner: sessions (list, then a session's detail), card history,
 * when the dataset carries the course's strategy docs, the pipeline with this
 * learner's run stats, and per-tag ELO. Session timelines link into card history. Navigation is internal;
 * hosts that want URLs can compose the views themselves.
 */
const props = defineProps<{
  dataset: LearnerDataset;
  interpreters?: DiagnosticsInterpreters;
}>();

const tab = ref<'sessions' | 'cards' | 'pipeline' | 'elo'>('sessions');
const sessionId = ref<string | null>(null);
const focusCard = ref<string | undefined>(undefined);
const pipelineStats = computed(() => pipelineRunStats(props.dataset));

function openCard(cardId: string): void {
  // Re-set through undefined so following the same card twice still refocuses.
  focusCard.value = undefined;
  tab.value = 'cards';
  setTimeout(() => (focusCard.value = cardId));
}

watch(
  () => props.dataset,
  () => {
    tab.value = 'sessions';
    sessionId.value = null;
    focusCard.value = undefined;
  }
);
</script>
