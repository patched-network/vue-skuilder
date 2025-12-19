<template>
  <v-container>
    <v-card>
      <v-card-title class="text-h4 mb-4">
        Register Question Types
      </v-card-title>

      <!-- Static Mode Warning -->
      <v-alert v-if="isStaticMode" type="warning" variant="tonal" class="ma-4">
        <v-alert-title>Static Mode Detected</v-alert-title>
        <p class="mb-2">
          Question type registration is not available in static mode.
        </p>
        <p class="mb-2">
          To register custom question types, use Studio mode:
        </p>
        <v-code tag="pre" class="text-caption">yarn studio</v-code>
        <p class="mt-2">
          Studio mode provides a development environment with full database access for registering question types.
        </p>
      </v-alert>

      <!-- Loading State -->
      <v-card-text v-else-if="loading">
        <v-progress-circular indeterminate color="primary" />
        <span class="ml-4">Loading question type data...</span>
      </v-card-text>

      <!-- Error State -->
      <v-alert v-else-if="error" type="error" variant="tonal" class="ma-4">
        <v-alert-title>Error</v-alert-title>
        {{ error }}
      </v-alert>

      <!-- Main Content -->
      <v-card-text v-else>
        <!-- Current State -->
        <div class="mb-6">
          <h3 class="text-h6 mb-2">Current CourseConfig</h3>
          <v-list density="compact">
            <v-list-item>
              <template #prepend>
                <v-icon>mdi-shape</v-icon>
              </template>
              <v-list-item-title>
                {{ currentDataShapeCount }} DataShapes registered
              </v-list-item-title>
            </v-list-item>
            <v-list-item>
              <template #prepend>
                <v-icon>mdi-help-circle</v-icon>
              </template>
              <v-list-item-title>
                {{ currentQuestionTypeCount }} QuestionTypes registered
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </div>

        <!-- Custom Questions -->
        <div class="mb-6">
          <h3 class="text-h6 mb-2">From allCustomQuestions()</h3>
          <v-list density="compact">
            <v-list-item>
              <template #prepend>
                <v-icon>mdi-shape</v-icon>
              </template>
              <v-list-item-title>
                {{ processedDataShapes.length }} DataShapes found
              </v-list-item-title>
            </v-list-item>
            <v-list-item>
              <template #prepend>
                <v-icon>mdi-help-circle</v-icon>
              </template>
              <v-list-item-title>
                {{ processedQuestions.length }} QuestionTypes found
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </div>

        <!-- Changes Preview -->
        <div v-if="hasChanges" class="mb-6">
          <h3 class="text-h6 mb-2">Changes to Apply</h3>
          <v-list density="compact">
            <v-list-item
              v-for="change in changesList"
              :key="change.key"
              :class="change.type === 'add' ? 'text-success' : 'text-info'"
            >
              <template #prepend>
                <v-icon :color="change.type === 'add' ? 'success' : 'info'">
                  {{ change.type === 'add' ? 'mdi-plus' : 'mdi-update' }}
                </v-icon>
              </template>
              <v-list-item-title>
                {{ change.label }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </div>

        <!-- No Changes Message -->
        <v-alert v-else type="info" variant="tonal">
          All question types are already registered. No changes needed.
        </v-alert>

        <!-- Success Message -->
        <v-alert v-if="successMessage" type="success" variant="tonal" class="mb-4">
          <v-alert-title>Success</v-alert-title>
          {{ successMessage }}
        </v-alert>
      </v-card-text>

      <!-- Actions -->
      <v-card-actions v-if="!isStaticMode && !loading && !error">
        <v-spacer />
        <v-btn
          color="primary"
          :disabled="!hasChanges || registering"
          :loading="registering"
          @click="registerQuestions"
        >
          Register Question Types
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getDataLayer } from '@vue-skuilder/db';
import {
  registerCustomQuestionTypes,
  processCustomQuestionsData,
  isDataShapeRegistered,
  isQuestionTypeRegistered,
  isDataShapeSchemaAvailable,
  type CustomQuestionsData,
  type ProcessedDataShape,
  type ProcessedQuestionData,
} from '@vue-skuilder/db';
import { useAuthStore } from '@vue-skuilder/common-ui';
import { allCustomQuestions } from '@sui/questions';
import config from '../../skuilder.config.json';

// State
const loading = ref(true);
const error = ref<string | null>(null);
const registering = ref(false);
const successMessage = ref<string | null>(null);

const courseConfig = ref<any>(null);
const customQuestions = ref<CustomQuestionsData | null>(null);
const processedDataShapes = ref<ProcessedDataShape[]>([]);
const processedQuestions = ref<ProcessedQuestionData[]>([]);

// Check if in static mode
const isStaticMode = computed(() => config.dataLayerType === 'static');

// Computed properties
const currentDataShapeCount = computed(() => courseConfig.value?.dataShapes?.length ?? 0);
const currentQuestionTypeCount = computed(() => courseConfig.value?.questionTypes?.length ?? 0);

interface Change {
  key: string;
  type: 'add' | 'update';
  label: string;
}

const changesList = computed<Change[]>(() => {
  if (!courseConfig.value || !customQuestions.value) return [];

  const changes: Change[] = [];

  // Check DataShapes
  for (const dataShape of processedDataShapes.value) {
    const isRegistered = isDataShapeRegistered(dataShape, courseConfig.value);
    const hasSchema = isDataShapeSchemaAvailable(dataShape, courseConfig.value);

    if (!isRegistered) {
      changes.push({
        key: `ds-add-${dataShape.course}.${dataShape.name}`,
        type: 'add',
        label: `Add DataShape: ${dataShape.course}.${dataShape.name}`,
      });
    } else if (!hasSchema) {
      changes.push({
        key: `ds-update-${dataShape.course}.${dataShape.name}`,
        type: 'update',
        label: `Update DataShape schema: ${dataShape.course}.${dataShape.name}`,
      });
    }
  }

  // Check QuestionTypes
  for (const question of processedQuestions.value) {
    if (!isQuestionTypeRegistered(question, courseConfig.value)) {
      changes.push({
        key: `qt-add-${question.course}.${question.name}`,
        type: 'add',
        label: `Add QuestionType: ${question.name}`,
      });
    }
  }

  return changes;
});

const hasChanges = computed(() => changesList.value.length > 0);

// Methods
async function loadData() {
  try {
    loading.value = true;
    error.value = null;

    // Load custom questions
    customQuestions.value = allCustomQuestions();

    // Process custom questions
    const processed = processCustomQuestionsData(customQuestions.value);
    processedDataShapes.value = processed.dataShapes;
    processedQuestions.value = processed.questions;

    // Load course config
    const courseId = config.course;
    if (!courseId) {
      throw new Error('No course ID configured in skuilder.config.json');
    }

    const courseDB = getDataLayer().getCourseDB(courseId);
    courseConfig.value = await courseDB.getCourseConfig();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
    console.error('[AdminRegisterQuestions] Failed to load data:', err);
  } finally {
    loading.value = false;
  }
}

async function registerQuestions() {
  if (!customQuestions.value || !courseConfig.value) {
    error.value = 'Missing data for registration';
    return;
  }

  try {
    registering.value = true;
    error.value = null;
    successMessage.value = null;

    const authStore = useAuthStore();
    const username = authStore.currentUser?.username || 'admin';

    const courseId = config.course;
    if (!courseId) {
      throw new Error('No course ID configured');
    }

    const courseDB = getDataLayer().getCourseDB(courseId);

    const result = await registerCustomQuestionTypes(
      customQuestions.value,
      courseConfig.value,
      courseDB,
      username
    );

    if (result.success) {
      successMessage.value = `Successfully registered ${result.registeredCount} items`;
      // Reload data to show updated state
      await loadData();
    } else {
      error.value = result.errorMessage || 'Registration failed';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
    console.error('[AdminRegisterQuestions] Registration failed:', err);
  } finally {
    registering.value = false;
  }
}

// Lifecycle
onMounted(() => {
  if (!isStaticMode.value) {
    loadData();
  }
});
</script>

<style scoped>
.v-code {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 8px 12px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

:deep(.v-theme--dark) .v-code {
  background-color: rgba(255, 255, 255, 0.05);
}
</style>
