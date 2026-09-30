<template>
  <v-container>
    <h1 class="text-h5 mb-4">Learner</h1>
    <learner-dataset-source
      :couch-url="couchUrl"
      :course-id="config.course"
      :initial-username="username"
      @loaded="onLoaded"
    />
    <learner-diagnostics v-if="dataset" :dataset="dataset" class="mt-6" />
  </v-container>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { ENV } from '@vue-skuilder/db';
import type { LearnerDataset } from '@vue-skuilder/db/diagnostics';
import { LearnerDatasetSource, LearnerDiagnostics } from '@vue-skuilder/common-ui/admin';
import '@vue-skuilder/common-ui/admin/style';
import config from '../../skuilder.config.json';

/**
 * Admin view of one learner in this course. Live loading needs the couch data
 * layer and an admin session; any layer can open a dump file.
 */
const props = defineProps<{ username?: string }>();

const router = useRouter();

const couchUrl =
  config.dataLayerType === 'couch' && ENV.COUCHDB_SERVER_URL !== 'NOT_SET'
    ? `${ENV.COUCHDB_SERVER_PROTOCOL}://${ENV.COUCHDB_SERVER_URL}`
    : undefined;

const dataset = shallowRef<LearnerDataset | null>(null);

function onLoaded(loaded: LearnerDataset): void {
  dataset.value = loaded;
  if (loaded.username !== props.username) {
    void router.replace({ name: 'AdminLearner', params: { username: loaded.username } });
  }
}
</script>
