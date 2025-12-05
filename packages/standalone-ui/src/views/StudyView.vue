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
import { useRoute } from 'vue-router';
import { ContentSourceID, getDataLayer } from '@vue-skuilder/db';
import { StudySession, type StudySessionConfig, useConfigStore } from '@vue-skuilder/common-ui';
import { allCourseWare } from '@vue-skuilder/courseware';
import { TagFilter, hasActiveFilter } from '@vue-skuilder/common';
import ENV from '../ENVIRONMENT_VARS';

const route = useRoute();

const user = getDataLayer().getUserDB();
const dataLayer = getDataLayer();
const configStore = useConfigStore();
const sessionPrepared = ref(false);
const sessionTimeLimit = ref(Number(configStore.config.sessionTimeLimit));
const sessionContentSources = ref<ContentSourceID[]>([]);
const studySessionConfig = ref<StudySessionConfig>({
  likesConfetti: configStore.config.likesConfetti,
});

// Function to get view component from courses
const getViewComponent = (view_id: string) => allCourseWare.getView(view_id);

/**
 * Parse tag filter from URL query parameters.
 *
 * Supports:
 * - ?include=tagA,tagB&exclude=tagC
 * - Comma-separated values for multiple tags
 */
const parseTagFilterFromQuery = (): TagFilter => {
  const includeParam = route.query.include;
  const excludeParam = route.query.exclude;

  const parseParam = (param: string | string[] | undefined | null): string[] => {
    if (!param) return [];
    if (Array.isArray(param)) {
      // Handle repeated params: ?include=a&include=b
      return param.flatMap((p) => (p ? p.split(',').map((t) => t.trim()) : [])).filter(Boolean);
    }
    // Handle comma-separated: ?include=a,b
    return param
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  };

  return {
    include: parseParam(includeParam as string | string[] | undefined),
    exclude: parseParam(excludeParam as string | string[] | undefined),
  };
};

// Initialize study session with course from environment vars
const initStudySession = async () => {
  // Check if course ID is valid
  if (!ENV.STATIC_COURSE_ID || ENV.STATIC_COURSE_ID === 'not_set') {
    console.error('[StudyView] No course ID specified in environment vars!');
    return;
  }

  console.log(`[StudyView] Starting study session for course: ${ENV.STATIC_COURSE_ID}`);

  // Parse tag filter from query params
  const tagFilter = parseTagFilterFromQuery();
  const source: ContentSourceID = {
    type: 'course',
    id: ENV.STATIC_COURSE_ID,
  };

  if (hasActiveFilter(tagFilter)) {
    source.tagFilter = tagFilter;
    console.log(`[StudyView] Tag filter from query params:`, tagFilter);
  }

  // Set the content source to the course ID from environment vars
  sessionContentSources.value = [source];

  // Mark the session as prepared
  sessionPrepared.value = true;
};

// Handle session finished
const handleSessionFinished = () => {
  // router.go(0); // Refresh the page
};

// Initialize on component mount
onMounted(async () => {
  // user.value = await getCurrentUser();

  // if (user.value) {
  await initStudySession();
  // } else {
  //   console.error('[StudyView] No user available!');
  // }
});
</script>
