<template>
  <div class="pa-8">
    <h1 class="text-h5 mb-4">Learner</h1>

    <div class="d-flex flex-wrap ga-4 mb-4">
      <v-autocomplete
        :model-value="courseId"
        :items="courseOptions"
        item-title="label"
        item-value="value"
        label="Course"
        density="compact"
        hide-details
        style="max-width: 28rem"
        @update:model-value="pickCourse"
      />
      <v-autocomplete
        :model-value="selectedUser"
        :items="userOptions"
        label="Learner"
        density="compact"
        hide-details
        style="max-width: 20rem"
        :disabled="!courseId"
        @update:model-value="pickUser"
      />
    </div>

    <learner-dataset-source
      v-if="courseId"
      :key="`${courseId}/${selectedUser ?? ''}`"
      :couch-url="couchUrl"
      :course-id="courseId"
      :initial-username="selectedUser"
      :autoload="!!selectedUser"
      @loaded="onLoaded"
    />
    <learner-diagnostics v-if="dataset" :dataset="dataset" class="mt-6" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { CourseLookup, getDataLayer } from '@vue-skuilder/db';
import type { LearnerDataset } from '@vue-skuilder/db/diagnostics';
import { LearnerDatasetSource, LearnerDiagnostics } from '@vue-skuilder/common-ui/admin';
import '@vue-skuilder/common-ui/admin/style';
import ENV from '../ENVIRONMENT_VARS';

/**
 * Admin view of one learner in one course: `/admin/learners/:courseId?/:username?`.
 * Reads through the admin's couch session cookie, same origin as the app.
 */
const props = defineProps<{ courseId?: string; username?: string }>();

const router = useRouter();
const couchUrl = `${ENV.COUCHDB_SERVER_PROTOCOL}://${ENV.COUCHDB_SERVER_URL}`;

const courseOptions = ref<Array<{ label: string; value: string }>>([]);
const userOptions = ref<string[]>([]);
// Drives the source component's key. The route can follow a learner typed
// into the component without remounting (and refetching) it.
const selectedUser = ref(props.username);
const dataset = shallowRef<LearnerDataset | null>(null);

function syncUrl(courseId?: string, username?: string): void {
  const parts = ['/admin/learners', courseId, courseId ? username : undefined].filter((p): p is string => !!p);
  void router.replace(parts.map((p, i) => (i === 0 ? p : encodeURIComponent(p))).join('/'));
}

function pickCourse(courseId: string | null): void {
  selectedUser.value = undefined;
  dataset.value = null;
  syncUrl(courseId ?? undefined);
}

function pickUser(username: string | null): void {
  selectedUser.value = username ?? undefined;
  syncUrl(props.courseId, selectedUser.value);
}

function onLoaded(loaded: LearnerDataset): void {
  dataset.value = loaded;
  if (loaded.username !== props.username) syncUrl(props.courseId, loaded.username);
}

onMounted(async () => {
  try {
    const courses = await CourseLookup.allCourseWare();
    courseOptions.value = courses
      .filter((c) => c._id)
      .map((c) => ({ label: c.name?.trim() || c._id, value: c._id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (e) {
    console.error('[AdminLearner] course list failed', e);
  }
  try {
    const users = await (await getDataLayer()).getAdminDB().getUsers();
    userOptions.value = users
      .map((u) => (u as { name?: string }).name)
      .filter((name): name is string => !!name && !name.startsWith('Guest'))
      .sort();
  } catch (e) {
    console.error('[AdminLearner] user list failed', e);
  }
});
</script>
