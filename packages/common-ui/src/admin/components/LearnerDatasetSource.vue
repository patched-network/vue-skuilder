<template>
  <v-card variant="outlined">
    <v-card-text>
      <div class="d-flex flex-wrap align-center ga-2">
        <v-text-field
          v-model="username"
          label="Learner"
          density="compact"
          hide-details
          style="max-width: 16rem"
          :disabled="!couchUrl || !courseId"
          @keydown.enter="loadLive"
        />
        <v-btn color="primary" :loading="loading" :disabled="!couchUrl || !courseId || !username" @click="loadLive">
          Load
        </v-btn>
        <span class="text-medium-emphasis mx-2">or</span>
        <v-btn variant="tonal" prepend-icon="mdi-file-upload-outline" @click="fileInput?.click()">
          Open dump file
        </v-btn>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFile" />
      </div>

      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-3">
        {{ error }}
      </v-alert>

      <div v-if="dataset && dump" class="d-flex flex-wrap align-center ga-2 mt-3">
        <span>
          <strong>{{ dataset.username }}</strong>
          · {{ dataset.sessions.length }} sessions
          <template v-if="sessionRange">({{ sessionRange }})</template>
          · {{ dataset.cardHistories.length }} cards seen · as of {{ dataset.asOf.slice(0, 16) }}Z
          <template v-if="!dataset.cards">· no course slice</template>
        </span>
        <v-spacer />
        <v-btn variant="text" size="small" prepend-icon="mdi-download" @click="downloadLearnerDump(dump)">
          Save dump
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { LearnerDataset, LearnerDump } from '@vue-skuilder/db/diagnostics';
import { downloadLearnerDump, useLearnerDataset } from '../composables/useLearnerDataset';

/**
 * Pick a learner's dataset: live from couch by username (needs `couchUrl` and
 * `courseId`), or from a dump file. Emits `loaded` with the indexed dataset
 * and the raw dump.
 */
const props = defineProps<{
  /** Couch base URL. Without it, only files can be opened. */
  couchUrl?: string;
  courseId?: string;
  /** Prefills the learner field. */
  initialUsername?: string;
}>();

const emit = defineEmits<{
  loaded: [dataset: LearnerDataset, dump: LearnerDump];
}>();

const { dump, dataset, loading, error, loadFromCouch, loadFromFile } = useLearnerDataset();
const username = ref(props.initialUsername ?? '');
const fileInput = ref<HTMLInputElement | null>(null);

const sessionRange = computed(() => {
  const s = dataset.value?.sessions ?? [];
  return s.length ? `${s[0].startTime.slice(0, 10)} .. ${s[s.length - 1].startTime.slice(0, 10)}` : '';
});

function loadLive(): void {
  if (!props.couchUrl || !props.courseId || !username.value) return;
  void loadFromCouch({ couchUrl: props.couchUrl, courseId: props.courseId, username: username.value });
}

function onFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void loadFromFile(file, props.courseId);
  input.value = '';
}

watch(dataset, (ds) => {
  if (ds && dump.value) emit('loaded', ds, dump.value);
});
</script>
