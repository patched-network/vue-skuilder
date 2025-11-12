<template>
  <v-app>
    <v-app-bar>
      <v-toolbar-title>
        <v-icon start>mdi-palette</v-icon>
        Skuilder Studio
      </v-toolbar-title>
      <v-spacer />

      <!-- Navigation buttons -->
      <v-btn-group v-if="courseId" class="mr-4">
        <v-btn :color="$route.name === 'browse' ? 'primary' : 'secondary'" @click="$router.push('/')">
          <v-icon start>mdi-magnify</v-icon>
          Browse Course
        </v-btn>
        <v-btn
          :color="$route.name === 'create-card' ? 'primary' : 'secondary'"
          @click="$router.push('/create-card')"
        >
          <v-icon start>mdi-card-plus</v-icon>
          Create Card
        </v-btn>
        <v-btn
          :color="$route.name === 'bulk-import' ? 'primary' : 'secondary'"
          @click="$router.push('/bulk-import')"
        >
          <v-icon start>mdi-file-import</v-icon>
          Bulk Import
        </v-btn>
      </v-btn-group>

      <studio-flush v-if="courseId" :course-id="courseId" />
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <div v-if="loading" class="text-center pa-4">
          <v-progress-circular indeterminate />
          <p class="mt-2">Loading studio environment...</p>
        </div>

        <div v-else-if="error" class="text-center pa-4">
          <v-icon color="error" size="48">mdi-alert-circle</v-icon>
          <h2 class="mt-2">Studio Error</h2>
          <p>{{ error }}</p>
        </div>

        <div v-else-if="courseId">
          <!-- Course information header -->
          <v-card class="mb-4" flat>
            <v-card-text>
              <div class="studio-header">
                <h1>Course Editor</h1>
                <p class="text-subtitle-1">
                  Editing course: <strong>{{ courseId }}</strong>
                </p>
              </div>
            </v-card-text>
          </v-card>

          <!-- Router view for different editing modes -->
          <router-view />
        </div>

        <div v-else class="text-center pa-4">
          <v-icon size="48">mdi-school</v-icon>
          <h2 class="mt-2">No Course Loaded</h2>
          <p>Studio is waiting for course data...</p>
        </div>
      </v-container>
    </v-main>

    <!-- Global services -->
    <snackbar-service id="SnackbarService" />
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { SnackbarService } from '@vue-skuilder/common-ui';
import StudioFlush from './components/StudioFlush.vue';
import { getStudioConfig, getConfigErrorMessage } from './config/development';

// Studio state
const loading = ref(true);
const error = ref<string | null>(null);
const courseId = ref<string | null>(null);

// Initialize studio environment
onMounted(async () => {
  try {
    // Get studio configuration (CLI-injected or environment variables)
    const studioConfig = getStudioConfig();

    if (!studioConfig) {
      throw new Error(getConfigErrorMessage());
    }

    // Use the actual course ID from the configuration
    courseId.value = studioConfig.database.name;

    // Debug: Check if course database is accessible
    console.log('Studio: Course ID set to', courseId.value);
    console.log('Studio: Data layer initialized, checking course access...');

    try {
      const dataLayer = (await import('@vue-skuilder/db')).getDataLayer();
      const courseDB = dataLayer.getCourseDB(studioConfig.database.name);
      console.log('Studio: CourseDB obtained:', courseDB);

      const courseConfig = await courseDB.getCourseConfig();
      console.log('Studio: Course config loaded:', courseConfig);
    } catch (dbError) {
      console.error('Studio: Course database error:', dbError);
    }

    loading.value = false;
  } catch (err) {
    console.error('Studio: Initialization error:', err);
    error.value = err instanceof Error ? err.message : 'Unknown error';
    loading.value = false;
  }
});
</script>

<style scoped>
.studio-header {
  padding: 16px 0;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 16px;
}
</style>
