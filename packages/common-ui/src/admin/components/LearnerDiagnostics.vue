<template>
  <div>
    <v-tabs v-model="tab" density="compact" class="mb-4">
      <v-tab value="sessions">Sessions ({{ dataset.sessions.length }})</v-tab>
      <v-tab value="cards">Cards ({{ dataset.cardHistories.length }})</v-tab>
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

    <learner-card-history v-else :dataset="dataset" :interpreters="interpreters" :focus="focusCard" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { DiagnosticsInterpreters, LearnerDataset } from '@vue-skuilder/db/diagnostics';
import LearnerCardHistory from './LearnerCardHistory.vue';
import LearnerSessionDetail from './LearnerSessionDetail.vue';
import LearnerSessionList from './LearnerSessionList.vue';

/**
 * One learner: sessions (list, then a session's detail) and card history,
 * with session timelines linking into card history. Navigation is internal;
 * hosts that want URLs can compose the three views themselves.
 */
const props = defineProps<{
  dataset: LearnerDataset;
  interpreters?: DiagnosticsInterpreters;
}>();

const tab = ref<'sessions' | 'cards'>('sessions');
const sessionId = ref<string | null>(null);
const focusCard = ref<string | undefined>(undefined);

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
