<template>
  <v-container>
    <v-card>
      <v-card-title class="text-h4 mb-4">
        Register Question Types
      </v-card-title>

      <!-- Access Denied -->
      <v-alert v-if="!isAuthorized" type="error" variant="tonal" class="ma-4">
        <v-alert-title>Access Denied</v-alert-title>
        <p class="mb-2">
          This admin page requires authentication with an authorized account.
        </p>
        <p v-if="!authStore.isLoggedIn" class="mb-2">
          Please <a href="#" @click.prevent="authStore.setLoginDialog(true)">log in</a> to continue.
        </p>
        <p v-else class="mb-2">
          Your account ({{ currentUsername }}) does not have admin privileges.
        </p>
      </v-alert>

      <!-- Static Mode Warning -->
      <v-alert v-else-if="isStaticMode" type="warning" variant="tonal" class="ma-4">
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
      <v-card-text v-else-if="isAuthorized && loading">
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
          <v-expansion-panels variant="accordion">
            <v-expansion-panel>
              <v-expansion-panel-title>
                <v-icon class="mr-2">mdi-shape</v-icon>
                {{ currentDataShapeCount }} DataShapes registered
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-list v-if="courseConfig?.dataShapes?.length" density="compact">
                  <v-list-item
                    v-for="ds in courseConfig.dataShapes"
                    :key="ds.name"
                  >
                    <template #default>
                      <v-list-item-title class="font-weight-medium">
                        {{ ds.name }}
                      </v-list-item-title>
                      <v-list-item-subtitle>
                        {{ ds.questionTypes?.length || 0 }} question types |
                        Schema: {{ ds.serializedZodSchema ? 'Yes' : 'No' }}
                      </v-list-item-subtitle>
                    </template>
                    <template #append>
                      <v-btn
                        icon="mdi-delete"
                        size="small"
                        variant="text"
                        color="error"
                        :loading="removing"
                        @click="confirmRemoveDataShape(ds.name)"
                      />
                    </template>
                  </v-list-item>
                </v-list>
                <div v-else class="text-medium-emphasis pa-2">
                  No DataShapes registered
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
            <v-expansion-panel>
              <v-expansion-panel-title>
                <v-icon class="mr-2">mdi-help-circle</v-icon>
                {{ currentQuestionTypeCount }} QuestionTypes registered
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-list v-if="courseConfig?.questionTypes?.length" density="compact">
                  <v-list-item
                    v-for="qt in courseConfig.questionTypes"
                    :key="qt.name"
                  >
                    <template #default>
                      <v-list-item-title class="font-weight-medium">
                        {{ qt.name }}
                      </v-list-item-title>
                      <v-list-item-subtitle>
                        Views: {{ qt.viewList?.join(', ') || 'none' }} |
                        DataShapes: {{ qt.dataShapeList?.join(', ') || 'none' }}
                      </v-list-item-subtitle>
                    </template>
                    <template #append>
                      <v-btn
                        icon="mdi-delete"
                        size="small"
                        variant="text"
                        color="error"
                        :loading="removing"
                        @click="confirmRemoveQuestionType(qt.name)"
                      />
                    </template>
                  </v-list-item>
                </v-list>
                <div v-else class="text-medium-emphasis pa-2">
                  No QuestionTypes registered
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </div>

        <!-- Custom Questions -->
        <div class="mb-6">
          <h3 class="text-h6 mb-2">From allCustomQuestions()</h3>
          <v-expansion-panels variant="accordion">
            <v-expansion-panel>
              <v-expansion-panel-title>
                <v-icon class="mr-2">mdi-shape</v-icon>
                {{ processedDataShapes.length }} DataShapes found
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-list v-if="processedDataShapes.length" density="compact">
                  <v-list-item
                    v-for="ds in processedDataShapes"
                    :key="`${ds.course}.${ds.name}`"
                  >
                    <v-list-item-title class="font-weight-medium">
                      {{ ds.course }}.{{ ds.name }}
                    </v-list-item-title>
                    <v-list-item-subtitle>
                      Fields: {{ ds.dataShape?.fields?.map(f => f.name).join(', ') || 'none' }}
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>
                <div v-else class="text-medium-emphasis pa-2">
                  No DataShapes found in allCustomQuestions()
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
            <v-expansion-panel>
              <v-expansion-panel-title>
                <v-icon class="mr-2">mdi-help-circle</v-icon>
                {{ processedQuestions.length }} QuestionTypes found
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-list v-if="processedQuestions.length" density="compact">
                  <v-list-item
                    v-for="q in processedQuestions"
                    :key="`${q.course}.${q.name}`"
                  >
                    <v-list-item-title class="font-weight-medium">
                      {{ q.course }}.{{ q.name }}
                    </v-list-item-title>
                    <v-list-item-subtitle>
                      DataShapes: {{ q.dataShapes?.map(ds => ds.name).join(', ') || 'none' }} |
                      Views: {{ q.views?.length || 0 }}
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>
                <div v-else class="text-medium-emphasis pa-2">
                  No QuestionTypes found in allCustomQuestions()
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
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
      <v-card-actions v-if="isAuthorized && !isStaticMode && !loading && !error">
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
  removeCustomQuestionTypes,
  processCustomQuestionsData,
  isDataShapeRegistered,
  isQuestionTypeRegistered,
  isDataShapeSchemaAvailable,
  type CustomQuestionsData,
  type ProcessedDataShape,
  type ProcessedQuestionData,
} from '@vue-skuilder/db';
import { useAuthStore, getCurrentUser } from '@vue-skuilder/common-ui';
import { allCustomQuestions } from '../questions';
import config from '../../skuilder.config.json';

// Admin usernames that can access this page
const ADMIN_USERNAMES = ['admin'];

// Auth state
const authStore = useAuthStore();
const currentUsername = ref<string | null>(null);

// Check if user is authorized (logged in + admin username)
const isAuthorized = computed(() => {
  if (!authStore.isLoggedIn) return false;
  if (!currentUsername.value) return false;
  return ADMIN_USERNAMES.includes(currentUsername.value);
});

// State
const loading = ref(true);
const error = ref<string | null>(null);
const registering = ref(false);
const removing = ref(false);
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

async function confirmRemoveDataShape(name: string) {
  if (!confirm(`Remove DataShape "${name}"? This cannot be undone.`)) {
    return;
  }
  await removeItems([name], []);
}

async function confirmRemoveQuestionType(name: string) {
  if (!confirm(`Remove QuestionType "${name}"? This cannot be undone.`)) {
    return;
  }
  await removeItems([], [name]);
}

async function removeItems(dataShapeNames: string[], questionTypeNames: string[]) {
  if (!courseConfig.value) {
    error.value = 'Missing course config for removal';
    return;
  }

  try {
    removing.value = true;
    error.value = null;
    successMessage.value = null;

    const courseId = config.course;
    if (!courseId) {
      throw new Error('No course ID configured');
    }

    const courseDB = getDataLayer().getCourseDB(courseId);

    const result = await removeCustomQuestionTypes(
      dataShapeNames,
      questionTypeNames,
      courseConfig.value,
      courseDB
    );

    if (result.success) {
      successMessage.value = `Successfully removed ${result.removedCount} items`;
      // Reload data to show updated state
      await loadData();
    } else {
      error.value = result.errorMessage || 'Removal failed';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
    console.error('[AdminRegisterQuestions] Removal failed:', err);
  } finally {
    removing.value = false;
  }
}

// Lifecycle
onMounted(async () => {
  // Check authorization first
  try {
    const user = await getCurrentUser();
    if (user) {
      currentUsername.value = user.getUsername();
    }
  } catch (err) {
    console.error('[AdminRegisterQuestions] Failed to get current user:', err);
  }

  // Only load data if authorized and not in static mode
  if (isAuthorized.value && !isStaticMode.value) {
    loadData();
  } else {
    loading.value = false;
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
