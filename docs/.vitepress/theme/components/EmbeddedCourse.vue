<!-- EmbeddedCourse.vue - Reusable component for embedding study sessions in docs -->
<template>
  <div class="embedded-course">
    <!-- Error state (hidden but logged) -->
    <div v-if="error" class="error-state" style="display: none;">
      <!-- Hidden error state for graceful degradation -->
    </div>
    
    <!-- Loading state -->
    <div v-else-if="isLoading" class="loading-state">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Loading course...</p>
      </div>
    </div>
    
    <!-- Study session active -->
    <div v-else-if="sessionPrepared && dataLayer && user && !isLoading" class="study-container">
      <div class="debug-info">
        <p><small>Debug: dataLayer={{!!dataLayer}}, user={{!!user}}, sessionPrepared={{sessionPrepared}}</small></p>
      </div>
      <StudySession
        :content-sources="contentSources" 
        :session-time-limit="sessionTimeLimit"
        :user="user"
        :data-layer="dataLayer"
        :session-config="sessionConfig"
        :get-view-component="getViewComponent"
        @session-finished="handleSessionFinished"
        @session-prepared="handleSessionPrepared"
        @session-error="handleSessionError"
        @card-loaded="handleCardLoaded"
        @card-response="handleCardResponse"
        @time-changed="handleTimeChanged"
      />
    </div>
    
    <!-- Ready to start or initialization state -->
    <div v-else class="init-state">
      <div class="init-content">
        <p v-if="!dataLayer">Initializing study session...</p>
        <p v-else>Ready to start study session!</p>
        <p><small>Debug: dataLayer={{!!dataLayer}}, user={{!!user}}, loading={{isLoading}}, error={{!!error}}</small></p>
        <button 
          v-if="dataLayer && user && !isLoading" 
          @click="startSession" 
          class="retry-button"
        >
          Start Session
        </button>
        <button 
          v-else 
          @click="initializeSession" 
          class="retry-button"
          :disabled="isLoading"
        >
          {{ isLoading ? 'Loading...' : 'Initialize' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { StudySession, type StudySessionConfig } from '@vue-skuilder/common-ui';
import { allCourseWare } from '@vue-skuilder/courseware';
import { type ContentSourceID } from '@vue-skuilder/db';
import { useStaticDataLayer } from '../composables/useStaticDataLayer';

// Props
interface Props {
  courseId?: string;
  sessionTimeLimit?: number;
  sessionConfig?: StudySessionConfig;
}

const props = withDefaults(defineProps<Props>(), {
  courseId: '2aeb8315ef78f3e89ca386992d00825b',
  sessionTimeLimit: 10,
  sessionConfig: () => ({ likesConfetti: true })
});

// Data layer composable
const { dataLayer, error: dataLayerError, isLoading: dataLayerLoading, initialize } = useStaticDataLayer([props.courseId]);

// Component state
const sessionPrepared = ref(false);
const error = ref<Error | null>(null);
const isLoading = ref(false);

// Computed properties for StudySession
const contentSources = computed<ContentSourceID[]>(() => [
  {
    type: 'course',
    id: props.courseId,
  }
]);

const user = computed(() => {
  if (!dataLayer.value) return null;
  try {
    return dataLayer.value.getUserDB();
  } catch (e) {
    console.error('[EmbeddedCourse] Error getting user DB:', e);
    return null;
  }
});

const sessionConfig = computed<StudySessionConfig>(() => ({
  likesConfetti: true,
  ...props.sessionConfig
}));

// View component getter
const getViewComponent = (viewId: string) => {
  try {
    return allCourseWare.getView(viewId);
  } catch (e) {
    console.error(`[EmbeddedCourse] Failed to get view component for ${viewId}:`, e);
    throw e;
  }
};

// Combined loading state
const combinedLoading = computed(() => {
  return dataLayerLoading.value || isLoading.value;
});

// Combined error state
const combinedError = computed(() => {
  return dataLayerError.value || error.value;
});

// Event handlers
const handleSessionFinished = () => {
  console.log('[EmbeddedCourse] Session finished');
  sessionPrepared.value = false;
  // Could emit event to parent or restart session
};

const handleSessionPrepared = () => {
  console.log('[EmbeddedCourse] Session prepared');
  sessionPrepared.value = true;
};

const handleSessionError = (errorData: any) => {
  console.error('[EmbeddedCourse] Session error:', errorData);
  error.value = new Error(errorData.message || 'Session error');
  sessionPrepared.value = false;
};

const handleCardLoaded = (cardData: any) => {
  console.log('[EmbeddedCourse] Card loaded:', cardData.cardID);
};

const handleCardResponse = (response: any) => {
  console.log('[EmbeddedCourse] Card response:', response);
};

const handleTimeChanged = (timeRemaining: number) => {
  // Could emit to parent for time display (removed noisy console.log)
};

// Initialize session
const initializeSession = async () => {
  try {
    console.log('[EmbeddedCourse] Starting initialization for course:', props.courseId);
    
    // Ensure data layer is initialized
    if (!dataLayer.value) {
      await initialize();
    }
    
    if (!dataLayer.value) {
      throw new Error('Data layer failed to initialize');
    }
    
    // Verify course access
    const courseDB = dataLayer.value.getCourseDB(props.courseId);
    const coursesDB = dataLayer.value.getCoursesDB();
    
    console.log('[EmbeddedCourse] CourseDB:', courseDB);
    console.log('[EmbeddedCourse] CoursesDB:', coursesDB);
    
    const courseConfig = await coursesDB.getCourseConfig(props.courseId);
    
    console.log('[EmbeddedCourse] Course config raw:', courseConfig);
    console.log('[EmbeddedCourse] Course name:', courseConfig?.name);
    console.log('[EmbeddedCourse] Course verified:', courseConfig?.name || 'Unknown course');
    
    // Ready to start session - user must click "Start Session" button
    console.log('[EmbeddedCourse] Data layer ready, waiting for user to start session');
    // sessionPrepared stays false until user clicks button
    
  } catch (e) {
    const err = e as Error;
    console.error('[EmbeddedCourse] Initialization failed:', err);
    error.value = err;
  }
};

// Method to start the actual study session
const startSession = () => {
  console.log('[EmbeddedCourse] User clicked Start Session');
  sessionPrepared.value = true;
};

// Auto-initialize on mount (data layer only, not session)
onMounted(async () => {
  console.log('[EmbeddedCourse] Mounted with props:', {
    courseId: props.courseId,
    sessionTimeLimit: props.sessionTimeLimit
  });
  
  await initializeSession();
});

// Watch for errors and log them
const watchError = computed(() => {
  const err = combinedError.value;
  if (err) {
    console.error('[EmbeddedCourse] Error state:', {
      message: err.message,
      stack: err.stack,
      courseId: props.courseId
    });
  }
  return err;
});
</script>

<style scoped>
.embedded-course {
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  padding: 1rem;
  margin: 1rem 0;
  min-height: 300px;
}

.loading-state, .init-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  text-align: center;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--vp-c-border);
  border-top: 3px solid var(--vp-c-brand);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-state p, .init-state p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}

.init-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.retry-button {
  background: var(--vp-c-brand);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background: var(--vp-c-brand-dark);
}

.retry-button:active {
  transform: scale(0.95);
}

.study-container {
  min-height: 0; /* Allow StudySession to define its own height */
}

/* StudySession will have its own styling, but we can add container constraints */
.study-container :deep(.StudySession) {
  border: none; /* Remove any default borders since we have our own */
  background: transparent;
}

/* Error state is hidden but we could style it for debugging */
.error-state {
  color: var(--vp-c-red);
  padding: 1rem;
  background: var(--vp-c-red-soft);
  border-radius: 6px;
  margin: 1rem 0;
}
</style>