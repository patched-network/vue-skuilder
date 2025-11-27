<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div v-if="sessionPrepared">
          <StudySession
            :content-sources="sessionContentSources"
            :session-time-limit="sessionTimeLimit"
            :user="user"
            :session-config="studySessionConfig"
            :data-layer="dataLayer"
            :get-view-component="getViewComponent"
            @session-finished="handleSessionFinished"
          />
        </div>
        <div v-else>
          <v-card class="pa-4">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
            <p class="mt-4">Preparing study session...</p>
          </v-card>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ContentSourceID, getDataLayer, StudyContentSource } from '@vue-skuilder/db';
import { StudySession, type StudySessionConfig, useConfigStore } from '@vue-skuilder/common-ui';
import { allCourseWare } from '@vue-skuilder/courseware';
import ENV from '../ENVIRONMENT_VARS';
import { useStudyConfigStore } from '../stores/studyConfig'; // Import the new store
import { TagFilteredContentSource, TagFilter } from '@vue-skuilder/db/src/study/TagFilteredContentSource';
import { CourseDB } from '@vue-skuilder/db/src/impl/couch'; // Needed if we want to add CourseDB as a source

const user = getDataLayer().getUserDB();
const dataLayer = getDataLayer();
const configStore = useConfigStore();
const studyConfigStore = useStudyConfigStore(); // Initialize the new store

const sessionPrepared = ref(false);
const sessionTimeLimit = ref(Number(configStore.config.sessionTimeLimit));
const sessionContentSources = ref<StudyContentSource[]>([]); // Changed type to StudyContentSource[]
const studySessionConfig = ref<StudySessionConfig>({
  likesConfetti: configStore.config.likesConfetti,
});

// Function to get view component from courses
const getViewComponent = (view_id: string) => allCourseWare.getView(view_id);

// Initialize study session
const initStudySession = async () => {
  if (studyConfigStore.hasConfig) {
    // Use TagFilteredContentSource if a filter is present
    const courseId = (studyConfigStore.tagFilter as TagFilter).include[0]; // Assuming single course context for filtered sessions
    if (!courseId) {
      console.error('[StudyView] Course ID not found in TagFilter for filtered session.');
      return;
    }
    sessionContentSources.value = [
      new TagFilteredContentSource(courseId, studyConfigStore.tagFilter as TagFilter, user),
    ];
    sessionTimeLimit.value = studyConfigStore.timeLimit as number;
    studyConfigStore.clearConfig(); // Clear the config after use
    console.log(`[StudyView] Starting tag-filtered study session for course: ${courseId}`);
  } else {
    // Fallback to existing logic using STATIC_COURSE_ID
    if (!ENV.STATIC_COURSE_ID || ENV.STATIC_COURSE_ID === 'not_set') {
      console.error('[StudyView] No course ID specified in environment vars and no tag filter found!');
      return;
    }
    console.log(`[StudyView] Starting default study session for course: ${ENV.STATIC_COURSE_ID}`);
    sessionContentSources.value = [
      new CourseDB(ENV.STATIC_COURSE_ID, () => Promise.resolve(user)), // CourseDB can also act as StudyContentSource
    ];
  }

  // Mark the session as prepared
  sessionPrepared.value = true;
};

// Handle session finished
const handleSessionFinished = () => {
  // router.go(0); // Refresh the page
};

// Initialize on component mount
onMounted(async () => {
  await initStudySession();
});
</script>
