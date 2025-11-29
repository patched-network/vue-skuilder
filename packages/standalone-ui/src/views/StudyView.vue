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
import { ContentSourceID, getDataLayer } from '@vue-skuilder/db';
import { StudySession, type StudySessionConfig, useConfigStore } from '@vue-skuilder/common-ui';
import { allCourseWare } from '@vue-skuilder/courseware';
import ENV from '../ENVIRONMENT_VARS';
import { useStudyConfigStore } from '@vue-skuilder/common-ui'; // Path will be updated after moving the store

const user = getDataLayer().getUserDB();
const dataLayer = getDataLayer();
const configStore = useConfigStore();
const studyConfigStore = useStudyConfigStore(); // Initialize the new store

const sessionPrepared = ref(false);
const sessionTimeLimit = ref(Number(configStore.config.sessionTimeLimit));
const sessionContentSources = ref<ContentSourceID[]>([]);
const studySessionConfig = ref<StudySessionConfig>({
  likesConfetti: configStore.config.likesConfetti,
});

const getViewComponent = (view_id: string) => allCourseWare.getView(view_id);

const initStudySession = async () => {
  if (studyConfigStore.hasConfig) {
    // If a filter is present, we still pass a normal ContentSourceID,
    // but StudySession component will be responsible for using the store's filter.
    // The `id` here should correspond to the course the tags belong to.
    const courseId = studyConfigStore.tagFilter?.include[0] ? (await dataLayer.getCoursesDB().findCourseByTag(studyConfigStore.tagFilter.include[0]))._id : ENV.STATIC_COURSE_ID;
    
    if (courseId) {
        sessionContentSources.value = [{ type: 'course', id: courseId }];
        sessionTimeLimit.value = studyConfigStore.timeLimit as number;
    } else {
        console.error('[StudyView] Could not determine course ID for tag-filtered session.');
        return;
    }
    console.log(`[StudyView] Preparing tag-filtered study session for course: ${courseId}`);
  } else {
    // Fallback to existing logic using STATIC_COURSE_ID
    if (!ENV.STATIC_COURSE_ID || ENV.STATIC_COURSE_ID === 'not_set') {
      console.error('[StudyView] No course ID specified in environment vars and no tag filter found!');
      return;
    }
    console.log(`[StudyView] Starting default study session for course: ${ENV.STATIC_COURSE_ID}`);
    sessionContentSources.value = [{ type: 'course', id: ENV.STATIC_COURSE_ID }];
  }

  sessionPrepared.value = true;
};

const handleSessionFinished = () => {
  // Optional: handle session end
};

onMounted(async () => {
  await initStudySession();
});
</script>
