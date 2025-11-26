<template>
  <v-container>
    <div v-if="courseId">
      <CourseInformation :course-id="courseId" :view-lookup-function="viewLookup" :edit-mode="editMode">
        <template #actions="{ editMode }">
          <!-- Standalone-ui specific actions - no registration/trial buttons -->
          <div v-if="editMode !== 'none'">
            <v-btn color="success" class="me-2" to="/study">Start Study Session</v-btn>
          </div>
        </template>
        <template #tag-link="{ tag, courseId: id }">
          <router-link :to="`/courses/${id}/tags/${tag.name}`">
            <v-chip variant="tonal" class="me-2 mb-2">
              {{ tag.name }}
            </v-chip>
          </router-link>
        </template>
      </CourseInformation>
    </div>
    <div v-else class="text-center">
      <v-alert type="error"> Course ID not found in configuration </v-alert>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { CourseInformation } from '@vue-skuilder/common-ui';
import { allCourseWare } from '@vue-skuilder/courseware';
import { getDataLayer } from '@vue-skuilder/db';
import config from '../../skuilder.config.json';

const courseId = ref<string>('');
const editMode = ref<'none' | 'readonly' | 'full'>('full');

// Full view lookup using courses package (same as platform-ui)
const viewLookup = (x: unknown) => {
  return allCourseWare.getView(x);
};

onMounted(() => {
  courseId.value = config.course || '';

  // Determine edit mode based on data layer capabilities
  const dataLayer = getDataLayer();
  editMode.value = dataLayer.isReadOnly() ? 'readonly' : 'full';
});
</script>
